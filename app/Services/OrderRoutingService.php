<?php

namespace App\Services;

use App\Models\KitchenBarTicket;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemModifier;
use App\Models\OrderStation;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\RestaurantTable;
use App\Models\SystemSetting;
use App\Models\TicketItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderRoutingService
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function present(Order $order): Order
    {
        $order->load([
            'table.diningArea:id,name',
            'waiter:id,name',
            'cashier:id,name',
            'items.menuItem:id,name,code',
            'items.modifiers',
            'tickets.orderStation:id,name,station_type,printer_model',
            'tickets.items.orderItem:id,name,special_instructions',
        ]);

        return $order;
    }

    /**
     * @param  array<string, mixed>  $orderData
     * @param  array<int, array<string, mixed>>  $itemsData
     */
    public function createOrder(array $orderData, array $itemsData, User $waiter): Order
    {
        return DB::transaction(function () use ($orderData, $itemsData, $waiter) {
            $branchId = (int) $orderData['branch_id'];
            $orderType = $orderData['order_type'] ?? 'dine_in';
            $table = $this->claimTable($branchId, $orderType, $orderData['restaurant_table_id'] ?? null);

            $order = Order::query()->create([
                'branch_id' => $branchId,
                'order_number' => $this->nextOrderNumber($branchId),
                'order_type' => $orderType,
                'restaurant_table_id' => $table?->id,
                'customer_name' => $orderData['customer_name'] ?? null,
                'customer_phone' => $orderData['customer_phone'] ?? null,
                'delivery_address' => $orderData['delivery_address'] ?? null,
                'waiter_id' => $waiter->id,
                'status' => 'in_preparation',
                'payment_status' => 'unpaid',
                'notes' => $orderData['notes'] ?? null,
                'subtotal' => 0,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'service_charge_amount' => 0,
                'total_amount' => 0,
                'amount_paid' => 0,
            ]);

            if ($table) {
                $table->update(['status' => 'occupied']);
            }

            $created = [];
            foreach ($itemsData as $row) {
                $created[] = $this->addItem($order, $row);
            }

            $this->applyTotals($order);
            $this->routeTickets($order, $created);
            $this->rememberStatus($order, null, 'in_preparation', $waiter, 'Order created and routed to preparation.');

            $this->auditLog->log('create', 'pos', "Created order {$order->order_number}", $order, branchId: $branchId);

            return $order->fresh();
        });
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     * @return array{order: Order, tickets: array<int, KitchenBarTicket>}
     */
    public function addItems(Order $order, array $itemsData, User $user): array
    {
        return DB::transaction(function () use ($order, $itemsData) {
            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'order' => ['This order is already '.$order->status.'.'],
                ]);
            }

            $created = [];
            foreach ($itemsData as $row) {
                $created[] = $this->addItem($order, $row);
            }

            $order->update(['status' => 'in_preparation']);
            $this->applyTotals($order);
            $tickets = $this->routeTickets($order, $created);
            $this->auditLog->log('update', 'pos', 'Added '.count($created)." item(s) to order {$order->order_number}", $order, branchId: $order->branch_id);

            return [
                'order' => $order->fresh(),
                'tickets' => $tickets,
            ];
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{order: Order, tickets: array<int, KitchenBarTicket>}
     */
    public function updateOpenOrder(Order $order, array $data, User $user): array
    {
        return DB::transaction(function () use ($order, $data, $user) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'order' => ['This order is already '.$order->status.'.'],
                ]);
            }

            if (! empty($data['waiter_id']) && (int) $data['waiter_id'] !== (int) $order->waiter_id) {
                $waiter = User::query()->whereKey($data['waiter_id'])->where('is_active', true)->first();

                if (! $waiter) {
                    throw ValidationException::withMessages([
                        'waiter_id' => ['Choose an active waiter.'],
                    ]);
                }

                $order->waiter_id = $waiter->id;
            }

            if (! empty($data['restaurant_table_id']) && (int) $data['restaurant_table_id'] !== (int) $order->restaurant_table_id) {
                $this->moveOpenOrder($order, (int) $data['restaurant_table_id'], $user);
            }

            $keptIds = [];
            $created = [];

            foreach ($data['lines'] as $line) {
                if (! empty($line['order_item_id'])) {
                    $itemId = (int) $line['order_item_id'];

                    if (in_array($itemId, $keptIds, true)) {
                        throw ValidationException::withMessages([
                            'lines' => ['Each order line can only be saved once.'],
                        ]);
                    }

                    $item = $order->items()->whereKey($itemId)->where('status', '!=', 'cancelled')->first();

                    if (! $item) {
                        throw ValidationException::withMessages([
                            'lines' => ['One of the order lines is no longer on this order.'],
                        ]);
                    }

                    $quantity = (float) $line['quantity'];
                    $modifierUnit = (float) $item->modifiers()->sum('unit_price');
                    $item->update([
                        'quantity' => $quantity,
                        'subtotal' => round(((float) $item->unit_price + $modifierUnit) * $quantity, 2),
                        'special_instructions' => $line['notes'] ?? null,
                    ]);

                    TicketItem::query()->where('order_item_id', $item->id)->update([
                        'quantity' => $quantity,
                        'special_instructions' => $line['notes'] ?? null,
                    ]);

                    $keptIds[] = $item->id;

                    continue;
                }

                if (empty($line['menu_item_id'])) {
                    throw ValidationException::withMessages([
                        'lines' => ['Each line needs an item.'],
                    ]);
                }

                $created[] = $this->addItem($order, $line);
                $keptIds[] = $created[array_key_last($created)]->id;
            }

            $removed = $keptIds === []
                ? $order->items()->where('status', '!=', 'cancelled')->get()
                : $order->items()->where('status', '!=', 'cancelled')->whereNotIn('id', $keptIds)->get();

            foreach ($removed as $item) {
                $item->update([
                    'status' => 'cancelled',
                    'cancelled_by' => $user->id,
                    'cancellation_reason' => 'Removed while editing the order.',
                ]);
                TicketItem::query()->where('order_item_id', $item->id)->update(['status' => 'cancelled']);
            }

            if (! $order->items()->where('status', '!=', 'cancelled')->exists()) {
                $placeholder = $this->placeholderItem($order);
                $created[] = $this->addItem($order, [
                    'menu_item_id' => $placeholder->id,
                    'quantity' => 1,
                ]);
            }

            $order->save();
            $this->applyTotals($order);
            $tickets = $created === [] ? [] : $this->routeTickets($order, $created);
            $this->rememberStatus($order, $order->status, $order->status, $user, 'Order edited from the POS terminal.');
            $this->auditLog->log('update', 'pos', "Edited order {$order->order_number}", $order, branchId: $order->branch_id);

            return [
                'order' => $order->fresh(),
                'tickets' => $tickets,
            ];
        });
    }

    public function settle(Order $order, string $method, float $amountTendered, User $cashier): Order
    {
        return DB::transaction(function () use ($order, $method, $amountTendered, $cashier) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'order' => ['This order is already '.$order->status.'.'],
                ]);
            }

            $balance = round((float) $order->total_amount - (float) $order->amount_paid, 2);

            if ($amountTendered + 0.001 < $balance) {
                throw ValidationException::withMessages([
                    'amount_tendered' => ['The amount is less than the balance of '.number_format($balance, 2).'.'],
                ]);
            }

            Payment::query()->create([
                'order_id' => $order->id,
                'branch_id' => $order->branch_id,
                'method' => $method,
                'amount' => $balance,
                'received_by' => $cashier->id,
                'paid_at' => now(),
            ]);

            $previous = $order->status;
            $order->update([
                'status' => 'completed',
                'payment_status' => 'paid',
                'amount_paid' => $order->total_amount,
                'cashier_id' => $cashier->id,
            ]);

            $this->releaseTable($order->restaurant_table_id);
            $this->rememberStatus($order, $previous, 'completed', $cashier, "Settled via {$method}.");
            $this->auditLog->log('settle', 'pos', "Settled order {$order->order_number} via {$method}", $order, branchId: $order->branch_id);

            return $order->fresh();
        });
    }

    public function cancel(Order $order, User $user, string $reason): Order
    {
        return DB::transaction(function () use ($order, $user, $reason) {
            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'reason' => ['This order is already '.$order->status.'.'],
                ]);
            }

            $previous = $order->status;
            $order->update([
                'status' => 'cancelled',
                'cancelled_by' => $user->id,
                'cancellation_reason' => $reason,
            ]);

            $order->items()->where('status', '!=', 'cancelled')->update(['status' => 'cancelled']);
            $order->tickets()->update(['status' => 'collected']);
            $this->releaseTable($order->restaurant_table_id);
            $this->rememberStatus($order, $previous, 'cancelled', $user, $reason);
            $this->auditLog->log('cancel', 'pos', "Cancelled order {$order->order_number}. {$reason}", $order, branchId: $order->branch_id);

            return $order->fresh();
        });
    }

    public function transferTable(Order $order, RestaurantTable $target, User $user): Order
    {
        return DB::transaction(function () use ($order, $target, $user) {
            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'target_table_id' => ['This order is already '.$order->status.'.'],
                ]);
            }

            if ($target->branch_id !== $order->branch_id || ! $target->is_active) {
                throw ValidationException::withMessages([
                    'target_table_id' => ['Choose an active table in this branch.'],
                ]);
            }

            if ($target->status !== 'available') {
                throw ValidationException::withMessages([
                    'target_table_id' => ["Table {$target->table_number} is not available."],
                ]);
            }

            $previousTableId = $order->restaurant_table_id;
            $order->update(['restaurant_table_id' => $target->id]);
            $target->update(['status' => 'occupied']);
            $this->releaseTable($previousTableId);
            $this->rememberStatus($order, $order->status, $order->status, $user, "Moved to table {$target->table_number}.");
            $this->auditLog->log('transfer', 'pos', "Moved order {$order->order_number} to table {$target->table_number}", $order, branchId: $order->branch_id);

            return $order->fresh();
        });
    }

    public function mergeTables(RestaurantTable $source, RestaurantTable $target, User $user): void
    {
        DB::transaction(function () use ($source, $target) {
            if ($source->branch_id !== $target->branch_id || $source->id === $target->id) {
                throw ValidationException::withMessages([
                    'target_table_id' => ['Choose a different table in this branch.'],
                ]);
            }

            if ($target->status === 'maintenance' || ! $target->is_active) {
                throw ValidationException::withMessages([
                    'target_table_id' => ["Table {$target->table_number} cannot take a merge."],
                ]);
            }

            $sourceOrder = $source->activeOrder()->lockForUpdate()->first();
            $targetOrder = $target->activeOrder()->lockForUpdate()->first();

            if ($sourceOrder && $targetOrder) {
                throw ValidationException::withMessages([
                    'target_table_id' => ['Both tables have open orders. Transfer one order instead of merging the tables.'],
                ]);
            }

            if ($sourceOrder) {
                $sourceOrder->update(['restaurant_table_id' => $target->id]);
                $target->update(['status' => 'occupied']);
            }

            $source->update([
                'merged_with_table_id' => $target->id,
                'status' => 'occupied',
            ]);

            $this->auditLog->log('merge', 'pos', "Merged table {$source->table_number} into table {$target->table_number}", $source, branchId: $source->branch_id);
        });
    }

    /**
     * @param  array<string, mixed>  $row
     */
    protected function addItem(Order $order, array $row): OrderItem
    {
        $menuItem = MenuItem::query()->with('category')->findOrFail($row['menu_item_id']);

        if (! $menuItem->is_active || ! $menuItem->is_available) {
            throw ValidationException::withMessages([
                'items' => ["{$menuItem->name} is not available."],
            ]);
        }

        if ($menuItem->branch_id !== null && $menuItem->branch_id !== $order->branch_id) {
            throw ValidationException::withMessages([
                'items' => ["{$menuItem->name} is not on this branch menu."],
            ]);
        }

        $quantity = (float) ($row['quantity'] ?? 1);
        $subtotal = round((float) $menuItem->price * $quantity, 2);

        $item = OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $menuItem->id,
            'name' => $menuItem->name,
            'quantity' => $quantity,
            'unit_price' => $menuItem->price,
            'subtotal' => $subtotal,
            'special_instructions' => $row['special_instructions'] ?? ($row['notes'] ?? null),
            'status' => 'sent',
            'preparation_department' => $menuItem->preparation_department,
            'order_station_id' => $this->resolveStationId($menuItem, $order->branch_id),
        ]);

        foreach ($row['modifiers'] ?? [] as $modifierId) {
            $modifier = $menuItem->modifiers()->whereKey($modifierId)->where('is_active', true)->first();
            if (! $modifier) {
                continue;
            }

            OrderItemModifier::query()->create([
                'order_item_id' => $item->id,
                'menu_item_modifier_id' => $modifier->id,
                'name' => $modifier->name,
                'unit_price' => $modifier->additional_price,
            ]);

            $subtotal += round((float) $modifier->additional_price * $quantity, 2);
        }

        if ((float) $item->subtotal !== $subtotal) {
            $item->update(['subtotal' => $subtotal]);
        }

        return $item->fresh();
    }

    protected function placeholderItem(Order $order): MenuItem
    {
        $item = MenuItem::query()
            ->forBranch($order->branch_id)
            ->where('is_active', true)
            ->where('is_available', true)
            ->whereRaw('LOWER(name) = ?', ['test-product'])
            ->first();

        if (! $item) {
            throw ValidationException::withMessages([
                'lines' => ['Add an available product named test-product before saving an order with no active items.'],
            ]);
        }

        return $item;
    }

    protected function applyTotals(Order $order): void
    {
        $subtotal = round((float) $order->items()->where('status', '!=', 'cancelled')->sum('subtotal'), 2);
        $serviceRate = (float) SystemSetting::get('service_charge_rate', 10, $order->branch_id);
        $vatRate = (float) SystemSetting::get('vat_rate', 15, $order->branch_id);
        $service = $order->order_type === 'dine_in' ? round($subtotal * ($serviceRate / 100), 2) : 0;
        $tax = round(($subtotal + $service) * ($vatRate / 100), 2);

        $order->update([
            'subtotal' => $subtotal,
            'service_charge_amount' => $service,
            'tax_amount' => $tax,
            'total_amount' => round($subtotal + $service + $tax, 2),
        ]);
    }

    /**
     * @param  array<int, OrderItem>  $items
     * @return array<int, KitchenBarTicket>
     */
    protected function routeTickets(Order $order, array $items): array
    {
        $createdTickets = [];
        $sequence = $order->tickets()->count();

        foreach (collect($items)->groupBy(fn (OrderItem $item) => $item->preparation_department.'|'.$item->order_station_id) as $group) {
            $sequence++;
            /** @var OrderItem $first */
            $first = $group->first();
            $prefix = $first->preparation_department === 'bar' ? 'BTK' : 'KTK';

            $ticket = KitchenBarTicket::query()->create([
                'branch_id' => $order->branch_id,
                'order_id' => $order->id,
                'order_station_id' => $first->order_station_id,
                'ticket_number' => sprintf('%s-%d-%04d', $prefix, $order->id, $sequence),
                'department' => $first->preparation_department,
                'status' => 'queued',
                'sent_at' => now(),
            ]);

            foreach ($group as $item) {
                TicketItem::query()->create([
                    'ticket_id' => $ticket->id,
                    'order_item_id' => $item->id,
                    'quantity' => $item->quantity,
                    'special_instructions' => $item->special_instructions,
                    'status' => 'queued',
                ]);
            }

            $createdTickets[] = $ticket->load(['orderStation', 'items.orderItem']);
        }

        return $createdTickets;
    }

    protected function resolveStationId(MenuItem $menuItem, int $branchId): ?int
    {
        $candidates = array_filter([
            $menuItem->order_station_id,
            $menuItem->category?->order_station_id,
        ]);

        if ($candidates !== []) {
            $match = OrderStation::query()
                ->whereIn('id', $candidates)
                ->where('station_type', $menuItem->preparation_department)
                ->where('is_active', true)
                ->value('id');

            if ($match) {
                return (int) $match;
            }
        }

        return OrderStation::query()
            ->where('branch_id', $branchId)
            ->where('station_type', $menuItem->preparation_department)
            ->where('is_active', true)
            ->value('id');
    }

    protected function claimTable(int $branchId, string $orderType, mixed $tableId): ?RestaurantTable
    {
        if ($orderType !== 'dine_in') {
            return null;
        }

        if (! $tableId) {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ['Choose a table for a dine-in order.'],
            ]);
        }

        $table = RestaurantTable::query()
            ->whereKey($tableId)
            ->where('branch_id', $branchId)
            ->lockForUpdate()
            ->first();

        if (! $table || ! $table->is_active) {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ['Choose an active table in this branch.'],
            ]);
        }

        if (in_array($table->status, ['occupied', 'maintenance'], true)) {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ["Table {$table->table_number} is {$table->status}."],
            ]);
        }

        return $table;
    }

    protected function moveOpenOrder(Order $order, int $tableId, User $user): void
    {
        $target = RestaurantTable::query()->whereKey($tableId)->lockForUpdate()->first();

        if (! $target || ! $target->is_active || $target->branch_id !== $order->branch_id) {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ['Choose an active table in this branch.'],
            ]);
        }

        if ($target->status !== 'available') {
            throw ValidationException::withMessages([
                'restaurant_table_id' => ["Table {$target->table_number} is not available."],
            ]);
        }

        $previousTableId = $order->restaurant_table_id;
        $order->restaurant_table_id = $target->id;
        $target->update(['status' => 'occupied']);
        $order->save();
        $this->releaseTable($previousTableId);
        $this->auditLog->log('transfer', 'pos', "Moved order {$order->order_number} to table {$target->table_number}", $order, branchId: $order->branch_id);
        $this->rememberStatus($order, $order->status, $order->status, $user, "Moved to table {$target->table_number}.");
    }

    protected function releaseTable(?int $tableId): void
    {
        if (! $tableId) {
            return;
        }

        $stillOpen = Order::query()
            ->where('restaurant_table_id', $tableId)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->exists();

        if ($stillOpen) {
            return;
        }

        RestaurantTable::query()->whereKey($tableId)->update(['status' => 'available']);

        RestaurantTable::query()
            ->where('merged_with_table_id', $tableId)
            ->update([
                'status' => 'available',
                'merged_with_table_id' => null,
            ]);
    }

    protected function nextOrderNumber(int $branchId): string
    {
        $count = Order::query()
            ->where('branch_id', $branchId)
            ->whereDate('created_at', today())
            ->count();

        do {
            $count++;
            $number = sprintf('ORD-%d-%s-%04d', $branchId, now()->format('Ymd'), $count);
        } while (Order::query()->where('order_number', $number)->exists());

        return $number;
    }

    protected function rememberStatus(Order $order, ?string $from, string $to, User $user, ?string $comments): void
    {
        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'status_from' => $from,
            'status_to' => $to,
            'changed_by' => $user->id,
            'comments' => $comments,
        ]);
    }
}
