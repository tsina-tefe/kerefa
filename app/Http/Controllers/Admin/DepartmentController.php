<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Department;
use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('departments.view'), 403);

        $search = $request->string('search')->toString();

        $departments = Department::query()
            ->with('branch:id,name,code')
            ->withCount('users')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('type', 'like', "%{$search}%")
                        ->orWhereHas('branch', function ($branch) use ($search) {
                            $branch->where('name', 'like', "%{$search}%")
                                ->orWhere('code', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/departments/index', [
            'departments' => $departments,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        return Inertia::render('admin/departments/form', [
            'department' => null,
            'branches' => $this->branches(),
            'types' => Department::typeOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $validated = $this->validateDepartment($request);
        $department = Department::query()->create($validated);

        $this->auditLog->log('create', 'departments', "Created department {$department->name}", $department, branchId: $department->branch_id);

        return to_route('departments.index')->with('success', __('Department created.'));
    }

    public function edit(Request $request, Department $department): Response
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $department->load('branch:id,name,code');

        return Inertia::render('admin/departments/form', [
            'department' => $department,
            'branches' => $this->branches(),
            'types' => Department::typeOptions(),
        ]);
    }

    public function update(Request $request, Department $department): RedirectResponse
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $department->update($this->validateDepartment($request, $department));

        $this->auditLog->log('update', 'departments', "Updated department {$department->name}", $department, branchId: $department->branch_id);

        return to_route('departments.index')->with('success', __('Department updated.'));
    }

    public function destroy(Request $request, Department $department): RedirectResponse
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        if ($department->users()->exists()) {
            return back()->with('error', __('This department has users and cannot be deleted.'));
        }

        $name = $department->name;
        $this->auditLog->log('delete', 'departments', "Deleted department {$name}", $department, branchId: $department->branch_id);
        $department->delete();

        return to_route('departments.index')->with('success', __('Department deleted.'));
    }

    /**
     * @return array{branch_id: int, code: string, name: string, type: string, is_active: bool}
     */
    protected function validateDepartment(Request $request, ?Department $department = null): array
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('departments', 'code')->where('branch_id', $request->integer('branch_id'))->ignore($department?->id),
            ],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', 'in:'.implode(',', array_keys(Department::typeOptions()))],
            'is_active' => ['boolean'],
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }

    /**
     * @return Collection<int, Branch>
     */
    protected function branches(): Collection
    {
        return Branch::query()->orderBy('name')->get(['id', 'name', 'code']);
    }
}
