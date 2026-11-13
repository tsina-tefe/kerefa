<?php

namespace App\Http\Controllers\Supply;

use App\Http\Controllers\Controller;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryStock;
use App\Models\StockTransaction;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use App\Services\InventoryLedger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected AuditLogService $auditLog,
        protected InventoryLedger $ledger,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('inventory.view'), 403);

        $branchId = $this->requireBranch($request);
        $search = $request->string('search')->toString();
        $categoryId = $request->integer('category_id') ?: null;

        $items = InventoryItem::query()
            ->with(['category:id,name', 'stocks' => fn ($query) => $query->where('branch_id', $branchId)])
            ->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id'))
            ->where('is_active', true)
            ->when($categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(function (InventoryItem $item) {
                $stock = $item->stocks->first();
                $onHand = (float) ($stock->current_stock ?? 0);
                $minimum = (float) ($stock->min_stock_level ?? 0);

                return [
                    'id' => $item->id,
                    'code' => $item->code,
                    'name' => $item->name,
                    'unit' => $item->unit,
                    'unit_cost' => (float) $item->unit_cost,
                    'current_stock' => $onHand,
                    'min_stock_level' => $minimum,
                    'stock_value' => round($onHand * (float) $item->unit_cost, 2),
                    'is_low' => $onHand <= $minimum,
                    'category' => $item->category ? ['id' => $item->category->id, 'name' => $item->category->name] : null,
                ];
            });

        $stocks = InventoryStock::query()->where('branch_id', $branchId)->with('item:id,unit_cost');
        $valuation = (float) $stocks->get()->sum(fn (InventoryStock $stock) => (float) $stock->current_stock * (float) ($stock->item->unit_cost ?? 0));

        $movements = StockTransaction::query()
            ->with(['item:id,name,unit', 'user:id,name'])
            ->where('branch_id', $branchId)
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (StockTransaction $movement) => [
                'id' => $movement->id,
                'type' => $movement->type,
                'quantity' => (float) $movement->quantity,
                'balance_after' => (float) $movement->balance_after,
                'notes' => $movement->notes,
                'created_at' => $movement->created_at?->toDateTimeString(),
                'item' => $movement->item?->name,
                'unit' => $movement->item?->unit,
                'user' => $movement->user?->name,
            ]);

        return Inertia::render('supply/inventory/index', [
            'items' => $items,
            'categories' => InventoryCategory::query()->withCount('items')->orderBy('name')->get(['id', 'name', 'code']),
            'movements' => $movements,
            'stats' => [
                'total_items' => InventoryItem::query()
                    ->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id'))
                    ->where('is_active', true)
                    ->count(),
                'low_stock_count' => InventoryStock::query()
                    ->where('branch_id', $branchId)
                    ->whereColumn('current_stock', '<=', 'min_stock_level')
                    ->count(),
                'valuation' => round($valuation, 2),
            ],
            'filters' => [
                'search' => $search,
                'category_id' => $categoryId ? (string) $categoryId : '',
            ],
            'can' => [
                'manage' => $request->user()->can('inventory.manage'),
                'adjust' => $request->user()->can('inventory.adjust'),
            ],
        ]);
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $category = InventoryCategory::query()->create([
            'name' => $validated['name'],
            'code' => $this->categoryCode($validated['name']),
            'description' => $validated['description'] ?? null,
        ]);

        $this->auditLog->log('create', 'inventory', "Created inventory category {$category->name}", $category);

        return back()->with('success', __('Category :name added.', ['name' => $category->name]));
    }

    public function updateCategory(Request $request, InventoryCategory $inventoryCategory): RedirectResponse
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $inventoryCategory->update([
            'name' => $validated['name'],
            'code' => $this->categoryCode($validated['name'], $inventoryCategory->id),
            'description' => $validated['description'] ?? $inventoryCategory->description,
        ]);

        $this->auditLog->log('update', 'inventory', "Updated inventory category {$inventoryCategory->name}", $inventoryCategory);

        return back()->with('success', __('Category :name updated.', ['name' => $inventoryCategory->name]));
    }

    public function storeItem(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('inventory.manage'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $request->validate([
            'category_id' => ['required', 'exists:inventory_categories,id'],
            'code' => ['required', 'string', 'max:50', 'unique:inventory_items,code'],
            'name' => ['required', 'string', 'max:150'],
            'unit' => ['required', 'string', 'max:30'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'min_stock_level' => ['nullable', 'numeric', 'min:0'],
        ]);

        $item = InventoryItem::query()->create([
            'branch_id' => $branchId,
            'category_id' => $validated['category_id'],
            'code' => Str::upper($validated['code']),
            'name' => $validated['name'],
            'unit' => $validated['unit'],
            'unit_cost' => $validated['unit_cost'],
            'is_active' => true,
        ]);

        InventoryStock::query()->create([
            'branch_id' => $branchId,
            'inventory_item_id' => $item->id,
            'current_stock' => 0,
            'min_stock_level' => $validated['min_stock_level'] ?? 0,
        ]);

        $this->auditLog->log('create', 'inventory', "Created stock item {$item->name}", $item, branchId: $branchId);

        return back()->with('success', __('Item :name added.', ['name' => $item->name]));
    }

    public function adjust(Request $request, InventoryItem $item): RedirectResponse
    {
        abort_unless($request->user()->can('inventory.adjust'), 403);

        $branchId = $this->requireBranch($request);
        abort_unless($item->branch_id === null || $item->branch_id === $branchId, 404);

        $validated = $request->validate([
            'type' => ['required', Rule::in(['in', 'out', 'wastage', 'adjustment'])],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->ledger->move(
            $item,
            $branchId,
            $validated['type'],
            (float) $validated['quantity'],
            $request->user(),
            $validated['notes'] ?? 'Manual stock adjustment',
        );

        $this->auditLog->log(
            'stock_adjusted',
            'inventory',
            "Adjusted stock for {$item->name} ({$validated['type']}: {$validated['quantity']} {$item->unit})",
            $item,
            branchId: $branchId,
        );

        return back()->with('success', __('Stock for :name adjusted.', ['name' => $item->name]));
    }

    protected function requireBranch(Request $request): int
    {
        $branchId = $this->branchContext->getActiveBranchId($request->user());
        abort_unless($branchId, 422, __('Select a branch before managing stock.'));

        return $branchId;
    }

    protected function categoryCode(string $name, ?int $ignoreId = null): string
    {
        $base = Str::upper(Str::slug($name, ''));
        $base = $base !== '' ? substr($base, 0, 20) : 'CAT';
        $code = $base;
        $suffix = 2;

        while (InventoryCategory::query()
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where('code', $code)
            ->exists()) {
            $code = $base.'-'.$suffix;
            $suffix++;
        }

        return $code;
    }
}
