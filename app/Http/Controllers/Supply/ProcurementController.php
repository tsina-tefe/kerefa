<?php

namespace App\Http\Controllers\Supply;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use App\Services\InventoryLedger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProcurementController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected AuditLogService $auditLog,
        protected InventoryLedger $ledger,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('procurement.view'), 403);

        $branchId = $this->requireBranch($request);

        $orders = PurchaseOrder::query()
            ->with(['supplier:id,name', 'creator:id,name', 'items:id,purchase_order_id,name,quantity_ordered,quantity_received,unit,unit_cost,subtotal'])
            ->where('branch_id', $branchId)
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('supply/procurement/index', [
            'orders' => $orders,
            'suppliers' => Supplier::query()->where('is_active', true)->orderBy('name')->get([
                'id', 'name', 'contact_person', 'phone', 'email', 'address',
            ]),
            'items' => InventoryItem::query()
                ->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id'))
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'unit', 'unit_cost']),
            'stats' => [
                'total_orders' => PurchaseOrder::query()->where('branch_id', $branchId)->count(),
                'suppliers_count' => Supplier::query()->where('is_active', true)->count(),
                'spend' => (float) PurchaseOrder::query()->where('branch_id', $branchId)->where('status', 'received')->sum('total_amount'),
            ],
            'can' => [
                'orders' => $request->user()->can('procurement.orders'),
                'receiving' => $request->user()->can('procurement.receiving'),
            ],
        ]);
    }

    public function storeSupplier(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('procurement.orders'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'contact_person' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $supplier = Supplier::query()->create([...$validated, 'is_active' => true]);
        $this->auditLog->log('create', 'procurement', "Added supplier {$supplier->name}", $supplier);

        return back()->with('success', __('Supplier :name added.', ['name' => $supplier->name]));
    }

    public function storeOrder(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('procurement.orders'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        $order = DB::transaction(function () use ($validated, $branchId, $request) {
            $catalog = InventoryItem::query()
                ->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id'))
                ->whereIn('id', collect($validated['items'])->pluck('inventory_item_id'))
                ->get()
                ->keyBy('id');

            if ($catalog->count() !== collect($validated['items'])->pluck('inventory_item_id')->unique()->count()) {
                throw ValidationException::withMessages([
                    'items' => ['Choose stock items from this branch.'],
                ]);
            }

            $lines = collect($validated['items'])->map(function (array $line) use ($catalog) {
                $item = $catalog[$line['inventory_item_id']];
                $quantity = round((float) $line['quantity'], 4);
                $cost = round((float) $line['unit_cost'], 4);

                return [
                    'inventory_item_id' => $item->id,
                    'name' => $item->name,
                    'quantity_ordered' => $quantity,
                    'quantity_received' => 0,
                    'unit' => $item->unit,
                    'unit_cost' => $cost,
                    'subtotal' => round($quantity * $cost, 4),
                ];
            });

            $order = PurchaseOrder::query()->create([
                'branch_id' => $branchId,
                'supplier_id' => $validated['supplier_id'],
                'po_number' => $this->nextPoNumber(),
                'status' => 'pending',
                'total_amount' => $lines->sum('subtotal'),
                'created_by' => $request->user()->id,
                'notes' => $validated['notes'] ?? null,
            ]);
            $order->items()->createMany($lines->all());

            return $order;
        });

        $this->auditLog->log(
            'po_created',
            'procurement',
            "Created purchase order {$order->po_number}",
            $order,
            branchId: $branchId,
        );

        return back()->with('success', __('Purchase order :po created.', ['po' => $order->po_number]));
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        abort_unless($request->user()->can('procurement.receiving'), 403);

        $branchId = $this->requireBranch($request);
        abort_unless($purchaseOrder->branch_id === $branchId, 404);

        DB::transaction(function () use ($purchaseOrder, $request, $branchId) {
            $order = PurchaseOrder::query()->whereKey($purchaseOrder->id)->lockForUpdate()->firstOrFail();

            if ($order->status !== 'pending') {
                throw ValidationException::withMessages([
                    'order' => ['This purchase order is already '.$order->status.'.'],
                ]);
            }

            $order->load('items.inventoryItem');

            foreach ($order->items as $line) {
                $remaining = round((float) $line->quantity_ordered - (float) $line->quantity_received, 4);
                if ($remaining <= 0 || $line->inventoryItem === null) {
                    continue;
                }

                $line->inventoryItem->update(['unit_cost' => $line->unit_cost]);
                $this->ledger->move(
                    $line->inventoryItem,
                    $branchId,
                    'in',
                    $remaining,
                    $request->user(),
                    "Received on {$order->po_number}",
                    $order,
                );
                $line->update(['quantity_received' => $line->quantity_ordered]);
            }

            $order->update(['status' => 'received']);
        });

        $this->auditLog->log(
            'po_received',
            'procurement',
            "Received purchase order {$purchaseOrder->po_number}",
            $purchaseOrder,
            branchId: $branchId,
        );

        return back()->with('success', __('Purchase order :po received into stock.', ['po' => $purchaseOrder->po_number]));
    }

    protected function requireBranch(Request $request): int
    {
        $branchId = $this->branchContext->getActiveBranchId($request->user());
        abort_unless($branchId, 422, __('Select a branch before managing procurement.'));

        return $branchId;
    }

    protected function nextPoNumber(): string
    {
        $prefix = 'PO-'.now()->format('Ymd').'-';
        $latest = PurchaseOrder::query()->where('po_number', 'like', $prefix.'%')->orderByDesc('po_number')->value('po_number');
        $sequence = $latest ? ((int) substr($latest, -4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
