<?php

namespace App\Http\Controllers\Pos;

use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\OrderStation;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MenuController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected AuditLogService $auditLog,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());
        $search = $request->string('search')->toString();
        $categoryId = $request->integer('category_id') ?: null;

        $items = MenuItem::query()
            ->with(['category:id,name', 'orderStation:id,name'])
            ->withCount('modifiers')
            ->forBranch($branchId)
            ->when($categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('pos/menu/index', [
            'items' => $items,
            'categories' => $this->categoryOptions($branchId),
            'stations' => $this->stationOptions($branchId),
            'filters' => [
                'search' => $search,
                'category_id' => $categoryId ? (string) $categoryId : '',
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());

        return Inertia::render('pos/menu/form', [
            'item' => null,
            'categories' => $this->categoryOptions($branchId),
            'stations' => $this->stationOptions($branchId),
            'departments' => MenuItem::preparationDepartments(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $this->validateItem($request, $branchId);

        $item = MenuItem::query()->create([
            ...$this->itemAttributes($validated),
            'branch_id' => $branchId,
        ]);
        $this->syncModifiers($item, $validated['modifiers'] ?? []);

        $this->auditLog->log('create', 'pos', "Created menu item {$item->name}", $item, branchId: $branchId);

        return to_route('menu.index')->with('success', __('Menu item created.'));
    }

    public function edit(Request $request, MenuItem $menuItem): Response
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuItem->branch_id);

        $branchId = $this->branchContext->getActiveBranchId($request->user());
        $menuItem->load('modifiers:id,menu_item_id,name,additional_price,is_active');

        return Inertia::render('pos/menu/form', [
            'item' => $menuItem,
            'categories' => $this->categoryOptions($branchId),
            'stations' => $this->stationOptions($branchId),
            'departments' => MenuItem::preparationDepartments(),
        ]);
    }

    public function update(Request $request, MenuItem $menuItem): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuItem->branch_id);

        $branchId = $menuItem->branch_id ?? $this->requireBranch($request);
        $validated = $this->validateItem($request, $branchId, $menuItem);

        $menuItem->update($this->itemAttributes($validated));
        $this->syncModifiers($menuItem, $validated['modifiers'] ?? []);

        $this->auditLog->log('update', 'pos', "Updated menu item {$menuItem->name}", $menuItem, branchId: $branchId);

        return to_route('menu.index')->with('success', __('Menu item updated.'));
    }

    public function destroy(Request $request, MenuItem $menuItem): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuItem->branch_id);

        $name = $menuItem->name;
        $this->auditLog->log('delete', 'pos', "Deleted menu item {$name}", $menuItem, branchId: $menuItem->branch_id);
        $menuItem->delete();

        return to_route('menu.index')->with('success', __('Menu item deleted.'));
    }

    public function toggleAvailability(Request $request, MenuItem $menuItem): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuItem->branch_id);

        $menuItem->update(['is_available' => ! $menuItem->is_available]);

        return back()->with('success', $menuItem->is_available
            ? __(':name is available.', ['name' => $menuItem->name])
            : __(':name is sold out.', ['name' => $menuItem->name]));
    }

    public function toggleFavorite(Request $request, MenuItem $menuItem): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuItem->branch_id);

        $menuItem->update(['is_favorite' => ! $menuItem->is_favorite]);

        return back()->with('success', $menuItem->is_favorite
            ? __(':name was added to favorites.', ['name' => $menuItem->name])
            : __(':name was removed from favorites.', ['name' => $menuItem->name]));
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);

        $branchId = $this->requireBranch($request);
        $validated = $this->validateCategory($request, $branchId);

        $category = MenuCategory::query()->create([
            ...$validated,
            'branch_id' => $branchId,
            'slug' => $this->uniqueSlug($validated['name'], $branchId),
            'sort_order' => (int) MenuCategory::query()->forBranch($branchId)->max('sort_order') + 1,
        ]);

        $this->auditLog->log('create', 'pos', "Created menu category {$category->name}", $category, branchId: $branchId);

        return back()->with('success', __('Category created.'));
    }

    public function updateCategory(Request $request, MenuCategory $menuCategory): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuCategory->branch_id);

        $branchId = $menuCategory->branch_id ?? $this->requireBranch($request);
        $validated = $this->validateCategory($request, $branchId, $menuCategory);

        $menuCategory->update([
            ...$validated,
            'slug' => $this->uniqueSlug($validated['name'], $branchId, $menuCategory->id),
        ]);

        $this->auditLog->log('update', 'pos', "Updated menu category {$menuCategory->name}", $menuCategory, branchId: $branchId);

        return back()->with('success', __('Category updated.'));
    }

    public function destroyCategory(Request $request, MenuCategory $menuCategory): RedirectResponse
    {
        abort_unless($request->user()->can('pos.menu.manage'), 403);
        $this->ensureVisible($request, $menuCategory->branch_id);

        if ($menuCategory->menuItems()->exists()) {
            return back()->with('error', __('This category has menu items and cannot be deleted.'));
        }

        $name = $menuCategory->name;
        $this->auditLog->log('delete', 'pos', "Deleted menu category {$name}", $menuCategory, branchId: $menuCategory->branch_id);
        $menuCategory->delete();

        return back()->with('success', __('Category deleted.'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateItem(Request $request, ?int $branchId, ?MenuItem $item = null): array
    {
        $request->merge([
            'code' => $request->input('code') ?: null,
            'cost_price' => $request->input('cost_price') === '' || $request->input('cost_price') === null ? null : $request->input('cost_price'),
            'order_station_id' => $request->input('order_station_id') ?: null,
            'modifiers' => collect($request->input('modifiers', []))
                ->filter(fn ($modifier) => filled($modifier['name'] ?? null))
                ->values()
                ->all(),
        ]);

        $validated = $request->validate([
            'category_id' => ['required', Rule::exists('menu_categories', 'id')->where(function ($query) use ($branchId) {
                $query->where(function ($inner) use ($branchId) {
                    $inner->where('branch_id', $branchId)->orWhereNull('branch_id');
                });
            })],
            'order_station_id' => ['nullable', Rule::exists('order_stations', 'id')->where('branch_id', $branchId)],
            'code' => ['nullable', 'string', 'max:30', Rule::unique('menu_items', 'code')->where('branch_id', $branchId)->ignore($item?->id)],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'preparation_department' => ['required', 'in:'.implode(',', array_keys(MenuItem::preparationDepartments()))],
            'is_available' => ['boolean'],
            'is_favorite' => ['boolean'],
            'is_active' => ['boolean'],
            'modifiers' => ['array'],
            'modifiers.*.name' => ['required', 'string', 'max:100'],
            'modifiers.*.additional_price' => ['nullable', 'numeric', 'min:0'],
            'modifiers.*.is_active' => ['boolean'],
        ]);

        $validated['is_available'] = $request->boolean('is_available');
        $validated['is_favorite'] = $request->boolean('is_favorite');
        $validated['is_active'] = $request->boolean('is_active');
        $validated['order_station_id'] = $validated['order_station_id']
            ?? MenuCategory::query()->whereKey($validated['category_id'])->value('order_station_id');

        return $validated;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function itemAttributes(array $validated): array
    {
        return collect($validated)->except('modifiers')->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $modifiers
     */
    protected function syncModifiers(MenuItem $item, array $modifiers): void
    {
        $item->modifiers()->delete();

        foreach ($modifiers as $modifier) {
            $item->modifiers()->create([
                'name' => $modifier['name'],
                'additional_price' => $modifier['additional_price'] ?? 0,
                'is_active' => (bool) ($modifier['is_active'] ?? true),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateCategory(Request $request, ?int $branchId, ?MenuCategory $category = null): array
    {
        $request->merge([
            'order_station_id' => $request->input('order_station_id') ?: null,
        ]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('menu_categories', 'name')->where('branch_id', $branchId)->ignore($category?->id)],
            'order_station_id' => ['nullable', Rule::exists('order_stations', 'id')->where('branch_id', $branchId)],
            'is_active' => ['boolean'],
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }

    protected function uniqueSlug(string $name, ?int $branchId, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;

        while (MenuCategory::query()
            ->where('branch_id', $branchId)
            ->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    protected function requireBranch(Request $request): int
    {
        $branchId = $this->branchContext->getActiveBranchId($request->user());
        abort_unless($branchId, 422, __('Select a branch before managing the menu.'));

        return $branchId;
    }

    protected function ensureVisible(Request $request, ?int $recordBranchId): void
    {
        $branchId = $this->branchContext->getActiveBranchId($request->user());

        abort_unless($recordBranchId === null || $recordBranchId === $branchId, 404);
    }

    /**
     * @return Collection<int, MenuCategory>
     */
    protected function categoryOptions(?int $branchId)
    {
        return MenuCategory::query()
            ->with('orderStation:id,name')
            ->withCount('menuItems')
            ->forBranch($branchId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    /**
     * @return Collection<int, OrderStation>
     */
    protected function stationOptions(?int $branchId)
    {
        return OrderStation::query()
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'station_type']);
    }
}
