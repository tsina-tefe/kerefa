<?php

namespace Tests\Feature\Pos;

use App\Models\Branch;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_manage_categories_and_menu_items(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');
        $branch = Branch::query()->create([
            'code' => 'MAIN',
            'name' => 'Main Branch',
            'currency' => 'ETB',
            'is_active' => true,
        ]);

        $this->actingAs($admin)->get('/menu')->assertOk();

        $this->actingAs($admin)->post('/menu-categories', [
            'name' => 'Hot Drinks',
            'is_active' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('menu_categories', [
            'name' => 'Hot Drinks',
            'branch_id' => $branch->id,
            'slug' => 'hot-drinks',
        ]);

        $categoryId = MenuCategory::query()->where('name', 'Hot Drinks')->value('id');

        $this->actingAs($admin)->post('/menu', [
            'category_id' => $categoryId,
            'code' => 'ESP',
            'name' => 'Espresso',
            'price' => 45,
            'preparation_department' => 'bar',
            'is_available' => true,
            'is_favorite' => true,
            'is_active' => true,
            'modifiers' => [
                ['name' => 'Extra shot', 'additional_price' => 15, 'is_active' => true],
            ],
        ])->assertRedirect();

        $this->assertDatabaseHas('menu_items', [
            'name' => 'Espresso',
            'code' => 'ESP',
            'branch_id' => $branch->id,
            'preparation_department' => 'bar',
            'is_favorite' => true,
        ]);

        $item = MenuItem::query()->where('code', 'ESP')->firstOrFail();
        $this->assertDatabaseHas('menu_item_modifiers', ['menu_item_id' => $item->id, 'name' => 'Extra shot']);

        $this->actingAs($admin)->post("/menu/{$item->id}/toggle-availability")->assertRedirect();
        $this->assertFalse($item->fresh()->is_available);

        $this->actingAs($admin)->post("/menu/{$item->id}/toggle-favorite")->assertRedirect();
        $this->assertFalse($item->fresh()->is_favorite);

        $this->actingAs($admin)->delete("/menu-categories/{$categoryId}")->assertRedirect()->assertSessionHas('error');

        $this->actingAs($admin)->delete("/menu/{$item->id}")->assertRedirect();
        $this->assertDatabaseMissing('menu_items', ['id' => $item->id]);

        $this->actingAs($admin)->delete("/menu-categories/{$categoryId}")->assertRedirect()->assertSessionHas('success');
        $this->assertDatabaseMissing('menu_categories', ['id' => $categoryId]);
    }

    public function test_cashier_cannot_open_the_menu(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)->get('/menu')->assertForbidden();
    }
}
