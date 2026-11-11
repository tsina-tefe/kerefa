<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\OrderStation;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrderStationController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected AuditLogService $auditLog,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('settings.view'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());

        $search = $request->string('search')->toString();

        $stations = OrderStation::query()
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->withCount('menuCategories')
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/stations/index', [
            'stations' => $stations,
            'filters' => ['search' => $search],
            'categories' => MenuCategory::query()
                ->when($branchId, fn ($query) => $query->where(function ($inner) use ($branchId) {
                    $inner->where('branch_id', $branchId)->orWhereNull('branch_id');
                }))
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'order_station_id']),
            'canManage' => $request->user()->can('settings.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $branchId = $this->branchContext->getActiveBranchId($request->user());

        if (! $branchId) {
            return back()->with('error', __('Choose an active branch before adding a station.'));
        }

        $validated = $this->validateStation($request, $branchId);
        $categoryIds = $validated['category_ids'] ?? [];
        unset($validated['category_ids']);

        $station = OrderStation::create([
            ...$validated,
            'branch_id' => $branchId,
            'is_active' => true,
            'auto_print' => $request->boolean('auto_print'),
        ]);

        $this->assignCategories($station, $categoryIds);

        $this->auditLog->log('create', 'stations', "Created station {$station->name}", $station, branchId: $branchId);

        return back()->with('success', __('Station created.'));
    }

    public function update(Request $request, OrderStation $station): RedirectResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $validated = $this->validateStation($request, $station->branch_id, $station);
        $categoryIds = $validated['category_ids'] ?? [];
        unset($validated['category_ids']);

        $station->update([
            ...$validated,
            'auto_print' => $request->boolean('auto_print'),
        ]);

        MenuCategory::query()->where('order_station_id', $station->id)->update(['order_station_id' => null]);
        MenuItem::query()->where('order_station_id', $station->id)->update(['order_station_id' => null]);
        $this->assignCategories($station, $categoryIds);

        $this->auditLog->log('update', 'stations', "Updated station {$station->name}", $station, branchId: $station->branch_id);

        return back()->with('success', __('Station updated.'));
    }

    public function toggle(Request $request, OrderStation $station): RedirectResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $station->update(['is_active' => ! $station->is_active]);

        return back()->with('success', $station->is_active ? __('Station activated.') : __('Station deactivated.'));
    }

    public function destroy(Request $request, OrderStation $station): RedirectResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $name = $station->name;
        $station->delete();

        $this->auditLog->log('delete', 'stations', "Deleted station {$name}");

        return back()->with('success', __('Station deleted.'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateStation(Request $request, ?int $branchId, ?OrderStation $station = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('order_stations', 'code')->where('branch_id', $branchId)->ignore($station?->id),
            ],
            'station_type' => ['required', 'string', 'in:kitchen,bar,grill,cafe,other'],
            'printer_model' => ['required', 'string', 'max:100'],
            'printer_connection' => ['required', 'string', 'in:thermal_80mm,network_ip,usb_spooler'],
            'printer_ip' => ['nullable', 'string', 'max:100'],
            'printer_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'paper_width_mm' => ['required', 'integer', 'in:58,80'],
            'print_copies' => ['required', 'integer', 'min:1', 'max:5'],
            'notes' => ['nullable', 'string', 'max:500'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:menu_categories,id'],
        ]);
    }

    /**
     * @param  array<int, int>  $categoryIds
     */
    protected function assignCategories(OrderStation $station, array $categoryIds): void
    {
        if ($categoryIds === []) {
            return;
        }

        MenuCategory::query()->whereIn('id', $categoryIds)->update(['order_station_id' => $station->id]);
        MenuItem::query()->whereIn('category_id', $categoryIds)->update(['order_station_id' => $station->id]);
    }
}
