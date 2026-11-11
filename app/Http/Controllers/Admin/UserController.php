<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('users.view'), 403);

        $search = $request->string('search')->toString();

        $users = User::query()
            ->with(['roles:id,name,label', 'branch:id,name,code'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('users.create'), 403);

        return Inertia::render('admin/users/form', [
            'user' => null,
            ...$this->formOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('users.create'), 403);

        $validated = $this->validateUser($request);

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'username' => $validated['username'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => $validated['password'],
                'branch_id' => $validated['branch_id'],
                'department_id' => $validated['department_id'] ?? null,
                'is_active' => $validated['is_active'],
            ]);

            $user->syncRoles($validated['roles']);
            $user->branches()->sync($validated['accessible_branches'] ?? []);

            return $user;
        });

        $this->auditLog->log('create', 'users', "Created user {$user->username}", $user);

        return to_route('users.index')->with('success', __('User created.'));
    }

    public function edit(Request $request, User $user): Response
    {
        abort_unless($request->user()->can('users.edit'), 403);

        $user->load(['roles:id,name,label', 'branches:id']);

        return Inertia::render('admin/users/form', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'branch_id' => $user->branch_id,
                'department_id' => $user->department_id,
                'is_active' => $user->is_active,
                'roles' => $user->roles->pluck('name'),
                'accessible_branches' => $user->branches->pluck('id'),
            ],
            ...$this->formOptions(),
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->can('users.edit'), 403);

        $validated = $this->validateUser($request, $user);

        if ($user->is($request->user()) && $user->isSuperAdmin() && ! in_array('super-admin', $validated['roles'], true)) {
            return back()->with('error', __('You cannot remove your own super administrator role.'));
        }

        DB::transaction(function () use ($user, $validated) {
            $user->fill([
                'name' => $validated['name'],
                'username' => $validated['username'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'branch_id' => $validated['branch_id'],
                'department_id' => $validated['department_id'] ?? null,
                'is_active' => $validated['is_active'],
            ]);

            if (! empty($validated['password'])) {
                $user->password = $validated['password'];
            }

            $user->save();
            $user->syncRoles($validated['roles']);
            $user->branches()->sync($validated['accessible_branches'] ?? []);
        });

        $this->auditLog->log('update', 'users', "Updated user {$user->username}", $user);

        return to_route('users.index')->with('success', __('User updated.'));
    }

    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->can('users.edit'), 403);

        if ($user->is($request->user())) {
            return back()->with('error', __('You cannot change your own status.'));
        }

        $user->update(['is_active' => ! $user->is_active]);

        $this->auditLog->log(
            'status_change',
            'users',
            $user->is_active ? "Activated {$user->username}" : "Deactivated {$user->username}",
            $user,
        );

        return back()->with('success', $user->is_active ? __('User activated.') : __('User deactivated.'));
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->can('users.delete'), 403);

        if ($user->is($request->user())) {
            return back()->with('error', __('You cannot delete your own account.'));
        }

        if ($user->hasRole('super-admin') && User::role('super-admin')->count() <= 1) {
            return back()->with('error', __('The last super administrator cannot be deleted.'));
        }

        $username = $user->username;
        $this->auditLog->log('delete', 'users', "Deleted user {$username}", $user);
        $user->delete();

        return to_route('users.index')->with('success', __('User deleted.'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function formOptions(): array
    {
        return [
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name', 'code']),
            'departments' => Department::query()->orderBy('name')->get(['id', 'name', 'branch_id', 'type']),
            'roles' => Role::query()->orderBy('name')->get(['id', 'name', 'label']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateUser(Request $request, ?User $user = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($user?->id)],
            'email' => ['required', 'string', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user?->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => [$user ? 'nullable' : 'required', 'confirmed', Password::defaults()],
            'branch_id' => ['required', 'exists:branches,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'is_active' => ['boolean'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,name'],
            'accessible_branches' => ['nullable', 'array'],
            'accessible_branches.*' => ['integer', 'exists:branches,id'],
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }
}
