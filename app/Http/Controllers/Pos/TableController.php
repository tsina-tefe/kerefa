<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\DiningArea;
use App\Models\RestaurantTable;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use App\Services\OrderRoutingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TableController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected OrderRoutingService $orders,
        protected AuditLogService $auditLog,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('pos.view'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());

        $areas = DiningArea::query()
            ->where('branch_id', $branchId)
            ->with([
                'tables' => fn ($query) => $query->with('activeOrder:orders.id,orders.restaurant_table_id,orders.order_number,orders.total_amount,orders.status')->orderBy('table_number'),
            ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return Inertia::render('pos/tables/index', [
            'areas' => $areas,
            'statuses' => RestaurantTable::statuses(),
        ]);
    }

    public function storeArea(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $this->validateArea($request, $branchId);

        $area = DiningArea::query()->create([
            ...$validated,
            'branch_id' => $branchId,
            'sort_order' => (int) DiningArea::query()->where('branch_id', $branchId)->max('sort_order') + 1,
        ]);

        $this->auditLog->log('create', 'pos', "Created dining area {$area->name}", $area, branchId: $branchId);

        return back()->with('success', __('Dining area created.'));
    }

    public function updateArea(Request $request, DiningArea $diningArea): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);
        $this->ensureBranch($request, $diningArea->branch_id);

        $validated = $this->validateArea($request, $diningArea->branch_id, $diningArea);
        $diningArea->update($validated);

        $this->auditLog->log('update', 'pos', "Updated dining area {$diningArea->name}", $diningArea, branchId: $diningArea->branch_id);

        return back()->with('success', __('Dining area updated.'));
    }

    public function destroyArea(Request $request, DiningArea $diningArea): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);
        $this->ensureBranch($request, $diningArea->branch_id);

        if ($diningArea->tables()->exists()) {
            return back()->with('error', __('This dining area has tables and cannot be deleted.'));
        }

        $name = $diningArea->name;
        $this->auditLog->log('delete', 'pos', "Deleted dining area {$name}", $diningArea, branchId: $diningArea->branch_id);
        $diningArea->delete();

        return back()->with('success', __('Dining area deleted.'));
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $this->validateTable($request, $branchId);

        $table = RestaurantTable::query()->create([
            ...$validated,
            'branch_id' => $branchId,
            'status' => $validated['status'] ?? 'available',
        ]);

        $this->auditLog->log('create', 'pos', "Registered table {$table->table_number}", $table, branchId: $branchId);

        return back()->with('success', __('Table created.'));
    }

    public function update(Request $request, RestaurantTable $restaurantTable): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);
        $this->ensureBranch($request, $restaurantTable->branch_id);

        $validated = $this->validateTable($request, $restaurantTable->branch_id, $restaurantTable);

        if ($restaurantTable->activeOrder()->exists() && ($validated['status'] ?? 'occupied') !== 'occupied') {
            return back()->with('error', __('This table has an open order, so its status stays occupied.'));
        }

        $restaurantTable->update($validated);

        $this->auditLog->log('update', 'pos', "Updated table {$restaurantTable->table_number}", $restaurantTable, branchId: $restaurantTable->branch_id);

        return back()->with('success', __('Table updated.'));
    }

    public function destroy(Request $request, RestaurantTable $restaurantTable): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);
        $this->ensureBranch($request, $restaurantTable->branch_id);

        if ($restaurantTable->orders()->exists()) {
            return back()->with('error', __('This table has orders and cannot be deleted.'));
        }

        $number = $restaurantTable->table_number;
        $this->auditLog->log('delete', 'pos', "Deleted table {$number}", $restaurantTable, branchId: $restaurantTable->branch_id);
        $restaurantTable->delete();

        return back()->with('success', __('Table deleted.'));
    }

    public function transfer(Request $request, RestaurantTable $restaurantTable): RedirectResponse
    {
        abort_unless($request->user()->can('pos.orders.edit'), 403);
        $this->ensureBranch($request, $restaurantTable->branch_id);

        $order = $restaurantTable->activeOrder;
        if (! $order) {
            return back()->with('error', __('This table does not have an open order.'));
        }

        $validated = $request->validate([
            'target_table_id' => ['required', 'integer', 'different:'.$restaurantTable->id],
        ]);

        $target = RestaurantTable::query()->findOrFail($validated['target_table_id']);
        $this->orders->transferTable($order, $target, $request->user());

        return back()->with('success', __('Order moved to table :number.', ['number' => $target->table_number]));
    }

    public function merge(Request $request, RestaurantTable $restaurantTable): RedirectResponse
    {
        abort_unless($request->user()->can('pos.tables.manage'), 403);
        $this->ensureBranch($request, $restaurantTable->branch_id);

        $validated = $request->validate([
            'target_table_id' => ['required', 'integer', 'different:'.$restaurantTable->id],
        ]);

        $target = RestaurantTable::query()->findOrFail($validated['target_table_id']);
        $this->ensureBranch($request, $target->branch_id);
        $this->orders->mergeTables($restaurantTable, $target, $request->user());

        return back()->with('success', __('Table merged into :number.', ['number' => $target->table_number]));
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateArea(Request $request, int $branchId, ?DiningArea $area = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('dining_areas', 'name')->where('branch_id', $branchId)->ignore($area?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateTable(Request $request, int $branchId, ?RestaurantTable $table = null): array
    {
        $validated = $request->validate([
            'dining_area_id' => ['required', Rule::exists('dining_areas', 'id')->where('branch_id', $branchId)],
            'table_number' => ['required', 'string', 'max:30', Rule::unique('restaurant_tables', 'table_number')->where('branch_id', $branchId)->ignore($table?->id)],
            'capacity' => ['required', 'integer', 'min:1', 'max:50'],
            'status' => ['required', 'in:available,reserved,maintenance,occupied'],
            'is_active' => ['boolean'],
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        if (! $table && $validated['status'] === 'occupied') {
            $validated['status'] = 'available';
        }

        return $validated;
    }

    protected function requireBranch(Request $request): int
    {
        $branchId = $this->branchContext->getActiveBranchId($request->user());
        abort_unless($branchId, 422, __('Select a branch first.'));

        return $branchId;
    }

    protected function ensureBranch(Request $request, ?int $branchId): void
    {
        abort_unless($branchId === $this->branchContext->getActiveBranchId($request->user()), 404);
    }
}
