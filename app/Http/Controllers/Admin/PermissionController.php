<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('permissions.view'), 403);

        $search = $request->string('search')->toString();

        $permissions = Permission::query()
            ->withCount('roles')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('module', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('module')
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/permissions/index', [
            'permissions' => $permissions,
            'filters' => ['search' => $search],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('permissions.manage'), 403);

        $validated = $this->validatePermission($request);

        $permission = Permission::query()->create([
            ...$validated,
            'guard_name' => 'web',
        ]);

        $this->auditLog->log('create', 'permissions', "Created permission {$permission->name}", $permission);

        return to_route('permissions.index')->with('success', __('Permission created.'));
    }

    public function update(Request $request, Permission $permission): RedirectResponse
    {
        abort_unless($request->user()->can('permissions.manage'), 403);

        $validated = $this->validatePermission($request, $permission);

        if ($validated['name'] !== $permission->name && $permission->roles()->exists()) {
            return back()->withErrors([
                'name' => __('This permission is assigned to a role, so its name cannot change.'),
            ])->withInput();
        }

        $permission->update($validated);

        $this->auditLog->log('update', 'permissions', "Updated permission {$permission->name}", $permission);

        return to_route('permissions.index')->with('success', __('Permission updated.'));
    }

    public function destroy(Request $request, Permission $permission): RedirectResponse
    {
        abort_unless($request->user()->can('permissions.manage'), 403);

        if ($permission->roles()->exists()) {
            return back()->with('error', __('This permission is assigned to a role and cannot be deleted.'));
        }

        $name = $permission->name;
        $this->auditLog->log('delete', 'permissions', "Deleted permission {$name}", $permission);
        $permission->delete();

        return to_route('permissions.index')->with('success', __('Permission deleted.'));
    }

    /**
     * @return array{name: string, module: string, description: ?string}
     */
    protected function validatePermission(Request $request, ?Permission $permission = null): array
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'regex:/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/',
                Rule::unique('permissions', 'name')->where('guard_name', 'web')->ignore($permission?->id),
            ],
            'module' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9]*$/'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['description'] = $validated['description'] ?: null;

        return $validated;
    }
}
