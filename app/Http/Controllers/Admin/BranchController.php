<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Order;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('branches.view'), 403);

        $search = $request->string('search')->toString();

        $branches = Branch::query()
            ->withCount('departments')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/branches/index', [
            'branches' => $branches,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        return Inertia::render('admin/branches/form', [
            'branch' => null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        $validated = $this->validateBranch($request);

        $branch = DB::transaction(function () use ($validated) {
            if ($validated['is_main']) {
                Branch::query()->update(['is_main' => false]);
            }

            return Branch::create($validated);
        });

        $this->auditLog->log('create', 'branches', "Created branch {$branch->name}", $branch, branchId: $branch->id);

        return to_route('branches.edit', $branch)->with('success', __('Branch created. Add departments if this location needs them.'));
    }

    public function edit(Request $request, Branch $branch): Response
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        $branch->load('departments');

        return Inertia::render('admin/branches/form', [
            'branch' => $branch,
        ]);
    }

    public function update(Request $request, Branch $branch): RedirectResponse
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        $validated = $this->validateBranch($request, $branch);

        DB::transaction(function () use ($branch, $validated) {
            if ($validated['is_main']) {
                Branch::query()->whereKeyNot($branch->id)->update(['is_main' => false]);
            }

            $branch->update($validated);
        });

        $this->auditLog->log('update', 'branches', "Updated branch {$branch->name}", $branch, branchId: $branch->id);

        return to_route('branches.index')->with('success', __('Branch updated.'));
    }

    public function destroy(Request $request, Branch $branch): RedirectResponse
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        if ($branch->is_main) {
            return back()->with('error', __('The main branch cannot be deleted.'));
        }

        if (Order::query()->where('branch_id', $branch->id)->exists()) {
            return back()->with('error', __('This branch has orders and cannot be deleted.'));
        }

        $name = $branch->name;
        $this->auditLog->log('delete', 'branches', "Deleted branch {$name}", $branch, branchId: $branch->id);

        DB::transaction(function () use ($branch) {
            $branch->departments()->delete();
            $branch->delete();
        });

        return to_route('branches.index')->with('success', __('Branch deleted.'));
    }

    public function storeDepartment(Request $request, Branch $branch): RedirectResponse
    {
        abort_unless($request->user()->can('branches.manage'), 403);

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('departments', 'code')->where('branch_id', $branch->id)],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', 'in:'.implode(',', array_keys(Department::typeOptions()))],
        ]);

        $department = $branch->departments()->create([
            ...$validated,
            'is_active' => true,
        ]);

        $this->auditLog->log('create', 'branches', "Added department {$department->name} to {$branch->name}", $department, branchId: $branch->id);

        return back()->with('success', __('Department added.'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateBranch(Request $request, ?Branch $branch = null): array
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('branches', 'code')->ignore($branch?->id)],
            'name' => ['required', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:100'],
            'currency' => ['required', 'string', 'max:10'],
            'is_main' => ['boolean'],
            'is_active' => ['boolean'],
        ]);

        $validated['is_main'] = $request->boolean('is_main');
        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }
}
