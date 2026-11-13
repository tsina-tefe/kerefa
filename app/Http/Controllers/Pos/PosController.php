<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\DiningArea;
use App\Models\MenuCategory;
use App\Models\Order;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\BranchContextService;
use App\Services\OrderRoutingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected OrderRoutingService $orders,
    ) {}

    public function terminal(Request $request): Response
    {
        abort_unless($request->user()->can('pos.view'), 403);

        $user = $request->user();
        $branch = $this->branchContext->getActiveBranch($user);
        $branchId = $branch?->id;

        $categories = MenuCategory::query()
            ->forBranch($branchId)
            ->where('is_active', true)
            ->with(['menuItems' => function ($query) use ($branchId) {
                $query->forBranch($branchId)
                    ->where('is_active', true)
                    ->where('is_available', true)
                    ->with([
                        'orderStation:id,name,station_type',
                        'modifiers' => fn ($modifiers) => $modifiers->where('is_active', true),
                    ])
                    ->orderBy('name');
            }])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->filter(fn (MenuCategory $category) => $category->menuItems->isNotEmpty())
            ->values();

        $areas = DiningArea::query()
            ->where('branch_id', $branchId)
            ->where('is_active', true)
            ->with(['tables' => function ($query) {
                $query->where('is_active', true)
                    ->orderBy('table_number')
                    ->with(['activeOrder.items.menuItem:id,name,code', 'activeOrder.waiter:id,name', 'activeOrder.table:id,table_number']);
            }])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $recentOrders = Order::query()
            ->with([
                'table.diningArea:id,name',
                'waiter:id,name',
                'items.menuItem:id,name,code',
                'items.modifiers',
                'tickets.orderStation:id,name,station_type,printer_model',
                'tickets.items.orderItem:id,name,special_instructions',
            ])
            ->where('branch_id', $branchId)
            ->latest('id')
            ->limit(50)
            ->get();

        $waiters = User::query()
            ->where('is_active', true)
            ->where(function ($query) use ($branchId, $user) {
                $query->where('branch_id', $branchId)
                    ->orWhere('id', $user->id)
                    ->orWhereHas('branches', fn ($branches) => $branches->where('branches.id', $branchId));
            })
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('pos/terminal', [
            'branch' => $branch,
            'categories' => $categories,
            'diningAreas' => $areas,
            'recentOrders' => $recentOrders,
            'waiters' => $waiters,
            'serviceChargeRate' => (float) SystemSetting::get('service_charge_rate', 10, $branchId),
            'vatRate' => (float) SystemSetting::get('vat_rate', 15, $branchId),
            'csrfToken' => csrf_token(),
            'routes' => [
                'storeOrder' => route('pos.orders.store'),
                'addItemsBase' => url('/pos/orders'),
                'settleBase' => url('/pos/orders'),
                'dashboard' => route('dashboard'),
                'tablesIndex' => route('tables.index'),
            ],
        ]);
    }

    public function storeOrder(Request $request): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()->can('pos.orders.create'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());
        abort_unless($branchId, 422, __('Select a branch first.'));

        $validated = $request->validate([
            'order_type' => ['required', 'in:dine_in,takeaway,delivery'],
            'restaurant_table_id' => ['nullable', 'required_if:order_type,dine_in', 'integer'],
            'waiter_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['nullable', 'required_if:order_type,delivery', 'string', 'max:100'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'delivery_address' => ['nullable', 'required_if:order_type,delivery', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.special_instructions' => ['nullable', 'string', 'max:255'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*' => ['integer'],
        ]);

        $waiter = $request->user();
        if (! empty($validated['waiter_id'])) {
            $selected = User::query()->whereKey($validated['waiter_id'])->where('is_active', true)->first();
            if ($selected) {
                $waiter = $selected;
            }
        }

        $order = $this->orders->createOrder([
            ...$validated,
            'branch_id' => $branchId,
        ], $validated['items'], $waiter);

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => __('Order :number sent.', ['number' => $order->order_number]),
                'order' => $this->orders->present($order),
            ]);
        }

        return to_route('pos.terminal')->with('success', __('Order :number sent.', ['number' => $order->order_number]));
    }
}
