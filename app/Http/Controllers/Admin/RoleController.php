<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('roles.view'), 403);

        $search = $request->string('search')->toString();

        $roles = Role::query()
            ->withCount('permissions', 'users')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('label', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/roles/index', [
            'roles' => $roles,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        return Inertia::render('admin/roles/edit', [
            'role' => null,
            'permissions' => $this->permissionOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        $validated = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $name = Str::slug($validated['label']);

        if ($name === '' || Role::query()->where('name', $name)->where('guard_name', 'web')->exists()) {
            return back()->withErrors(['label' => __('A role with this name already exists.')])->withInput();
        }

        $role = Role::query()->create([
            'name' => $name,
            'guard_name' => 'web',
            'label' => $validated['label'],
            'description' => $validated['description'] ?? null,
            'is_system' => false,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        $this->auditLog->log('create', 'roles', "Created role {$role->name}", $role);

        return to_route('roles.index')->with('success', __('Role created.'));
    }

    public function edit(Request $request, Role $role): Response
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        $role->load('permissions:id,name');

        return Inertia::render('admin/roles/edit', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'label' => $role->label ?: $role->name,
                'description' => $role->description,
                'is_system' => (bool) $role->is_system,
                'permissions' => $role->permissions->pluck('name'),
            ],
            'permissions' => $this->permissionOptions(),
        ]);
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        if ($role->name === 'super-admin') {
            return back()->with('error', __('The super administrator role keeps every permission.'));
        }

        $validated = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role->update([
            'label' => $validated['label'],
            'description' => $validated['description'] ?? null,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        $this->auditLog->log('update', 'roles', "Updated role {$role->name}", $role);

        return to_route('roles.index')->with('success', __('Role updated.'));
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        if ($role->is_system || $role->name === 'super-admin') {
            return back()->with('error', __('System roles cannot be deleted.'));
        }

        if ($role->users()->exists()) {
            return back()->with('error', __('Remove this role from its users before deleting it.'));
        }

        $name = $role->name;
        $this->auditLog->log('delete', 'roles', "Deleted role {$name}", $role);
        $role->delete();

        return to_route('roles.index')->with('success', __('Role deleted.'));
    }

    /**
     * @return Collection<int, Permission>
     */
    protected function permissionOptions()
    {
        return Permission::query()
            ->orderBy('module')
            ->orderBy('name')
            ->get(['name', 'module', 'description']);
    }
}
