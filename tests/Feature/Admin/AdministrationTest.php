<?php

namespace Tests\Feature\Admin;

use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AdministrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_from_users(): void
    {
        $this->get('/users')->assertRedirect('/login');
    }

    public function test_super_admin_can_view_users_and_create_a_branch(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');

        $this->actingAs($admin)->get('/users')->assertOk();
        $this->actingAs($admin)->get('/dashboard')->assertOk();

        $this->actingAs($admin)->post('/branches', [
            'code' => 'B01',
            'name' => 'Bole',
            'currency' => 'ETB',
            'is_active' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('branches', ['code' => 'B01', 'name' => 'Bole']);

        $branch = Branch::query()->where('code', 'B01')->first();
        $this->actingAs($admin)->delete("/branches/{$branch->id}")->assertRedirect();
        $this->assertDatabaseMissing('branches', ['code' => 'B01']);
    }

    public function test_cashier_cannot_open_user_administration(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)->get('/users')->assertForbidden();
        $this->actingAs($cashier)->get('/permissions')->assertForbidden();
        $this->actingAs($cashier)->get('/departments')->assertForbidden();
    }

    public function test_inactive_users_cannot_log_in(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->post('/login', [
            'username' => $user->username,
            'password' => 'password',
        ])->assertSessionHasErrors('username');

        $this->assertGuest();
    }

    public function test_super_admin_can_manage_permissions_and_departments(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');

        $this->actingAs($admin)->get('/permissions')->assertOk();
        $this->actingAs($admin)->get('/departments')->assertOk();

        $this->actingAs($admin)->post('/permissions', [
            'name' => 'reports.custom',
            'module' => 'reports',
            'description' => 'Custom report access',
        ])->assertRedirect();

        $this->assertDatabaseHas('permissions', ['name' => 'reports.custom', 'module' => 'reports']);

        $permission = Permission::findByName('reports.custom');
        $this->actingAs($admin)->put("/permissions/{$permission->id}", [
            'name' => 'reports.custom',
            'module' => 'reports',
            'description' => 'Updated custom report access',
        ])->assertRedirect();

        $this->actingAs($admin)->delete("/permissions/{$permission->id}")->assertRedirect();
        $this->assertDatabaseMissing('permissions', ['name' => 'reports.custom']);

        $seeded = Permission::findByName('users.view');
        $this->actingAs($admin)->delete("/permissions/{$seeded->id}")->assertRedirect()->assertSessionHas('error');
        $this->assertDatabaseHas('permissions', ['name' => 'users.view']);

        $branch = Branch::query()->create([
            'code' => 'TST',
            'name' => 'Test Branch',
            'currency' => 'ETB',
            'is_active' => true,
        ]);

        $this->actingAs($admin)->post('/departments', [
            'branch_id' => $branch->id,
            'code' => 'kit',
            'name' => 'Kitchen',
            'type' => 'kitchen',
            'is_active' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('departments', ['code' => 'KIT', 'name' => 'Kitchen', 'branch_id' => $branch->id]);

        $department = Department::query()->where('code', 'KIT')->firstOrFail();
        $this->actingAs($admin)->put("/departments/{$department->id}", [
            'branch_id' => $branch->id,
            'code' => 'KIT',
            'name' => 'Main Kitchen',
            'type' => 'kitchen',
            'is_active' => true,
        ])->assertRedirect();

        $member = User::factory()->create([
            'branch_id' => $branch->id,
            'department_id' => $department->id,
        ]);
        $this->actingAs($admin)->delete("/departments/{$department->id}")->assertRedirect()->assertSessionHas('error');

        $member->update(['department_id' => null]);
        $this->actingAs($admin)->delete("/departments/{$department->id}")->assertRedirect();
        $this->assertDatabaseMissing('departments', ['id' => $department->id]);
    }
}
