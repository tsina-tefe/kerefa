<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\BranchContextService;
use App\Services\OrderRoutingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected OrderRoutingService $orders,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('pos.view'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());
        $search = $request->string('search')->toString();
        $status = $request->string('status')->toString();
        $orderType = $request->string('order_type')->toString();
        $dateFrom = $request->string('date_from')->toString();
        $dateTo = $request->string('date_to')->toString();

        if ($this->isDate($dateFrom) && $this->isDate($dateTo) && $dateFrom > $dateTo) {
            [$dateFrom, $dateTo] = [$dateTo, $dateFrom];
        }

        $filtered = Order::query()
            ->where('branch_id', $branchId)
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($orderType !== '', fn ($query) => $query->where('order_type', $orderType))
            ->when($this->isDate($dateFrom), fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($this->isDate($dateTo), fn ($query) => $query->whereDate('created_at', '<=', $dateTo))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('order_number', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%")
                        ->orWhere('customer_phone', 'like', "%{$search}%");
                });
            });

        $dateApplied = $this->isDate($dateFrom) || $this->isDate($dateTo);

        $orders = (clone $filtered)
            ->with(['table:id,table_number', 'waiter:id,name'])
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('pos/orders/index', [
            'orders' => $orders,
            'grand_total' => $dateApplied ? round((float) (clone $filtered)->sum('total_amount'), 2) : null,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'order_type' => $orderType,
                'date_from' => $this->isDate($dateFrom) ? $dateFrom : '',
                'date_to' => $this->isDate($dateTo) ? $dateTo : '',
            ],
            'statuses' => Order::statuses(),
            'types' => Order::types(),
        ]);
    }

    public function show(Request $request, Order $order): Response
    {
        abort_unless($request->user()->can('pos.view'), 403);
        $this->ensureBranch($request, $order->branch_id);

        $order->load([
            'table.diningArea:id,name',
            'waiter:id,name',
            'cashier:id,name',
            'cancelledBy:id,name',
            'items.modifiers',
            'tickets.orderStation:id,name',
            'payments.receiver:id,name',
            'statusHistory.changedBy:id,name',
        ]);

        return Inertia::render('pos/orders/show', [
            'order' => $order,
            'statuses' => Order::statuses(),
            'types' => Order::types(),
            'methods' => Order::paymentMethods(),
        ]);
    }

    public function addItems(Request $request, Order $order): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()->can('pos.orders.edit'), 403);
        $this->ensureBranch($request, $order->branch_id);

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.special_instructions' => ['nullable', 'string', 'max:255'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*' => ['integer'],
        ]);

        $result = $this->orders->addItems($order, $validated['items'], $request->user());

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => __('Items added to :number.', ['number' => $order->order_number]),
                'order' => $this->orders->present($result['order']),
                'new_tickets' => $result['tickets'],
            ]);
        }

        return back()->with('success', __('Items added to :number.', ['number' => $order->order_number]));
    }

    public function updateOpen(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->can('pos.orders.edit'), 403);
        $this->ensureBranch($request, $order->branch_id);

        $validated = $request->validate([
            'waiter_id' => ['nullable', 'integer', 'exists:users,id'],
            'restaurant_table_id' => ['nullable', 'integer'],
            'lines' => ['present', 'array'],
            'lines.*.order_item_id' => ['nullable', 'integer'],
            'lines.*.menu_item_id' => ['nullable', 'integer', 'exists:menu_items,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'lines.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $this->orders->updateOpenOrder($order, $validated, $request->user());

        return response()->json([
            'success' => true,
            'message' => __('Order :number updated.', ['number' => $order->order_number]),
            'order' => $this->orders->present($result['order']),
            'new_tickets' => $result['tickets'],
        ]);
    }

    public function settle(Request $request, Order $order): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()->can('pos.orders.settle'), 403);
        $this->ensureBranch($request, $order->branch_id);

        if (! $request->filled('method') && $request->filled('payment_method')) {
            $request->merge(['method' => $request->input('payment_method')]);
        }

        $validated = $request->validate([
            'method' => ['required', 'in:'.implode(',', array_keys(Order::paymentMethods()))],
            'amount_tendered' => ['required', 'numeric', 'min:0'],
        ]);

        $settled = $this->orders->settle($order, $validated['method'], (float) $validated['amount_tendered'], $request->user());

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => __('Order :number settled.', ['number' => $order->order_number]),
                'order' => $this->orders->present($settled),
            ]);
        }

        return back()->with('success', __('Order :number settled.', ['number' => $order->order_number]));
    }

    public function cancel(Request $request, Order $order): RedirectResponse
    {
        abort_unless($request->user()->can('pos.orders.cancel'), 403);
        $this->ensureBranch($request, $order->branch_id);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $this->orders->cancel($order, $request->user(), $validated['reason']);

        return back()->with('success', __('Order :number cancelled.', ['number' => $order->order_number]));
    }

    protected function isDate(string $value): bool
    {
        $parsed = \DateTime::createFromFormat('Y-m-d', $value);

        return $parsed instanceof \DateTime && $parsed->format('Y-m-d') === $value;
    }

    protected function ensureBranch(Request $request, ?int $branchId): void
    {
        abort_unless($branchId === $this->branchContext->getActiveBranchId($request->user()), 404);
    }
}
