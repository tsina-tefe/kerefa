<?php

namespace Tests\Feature\Pos;

use App\Models\Branch;
use App\Models\DiningArea;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_dine_in_order_occupies_a_table_and_settlement_frees_it(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');
        $waiter = User::factory()->create();
        $waiter->assignRole('waiter');

        $branch = Branch::query()->create([
            'code' => 'BOLE',
            'name' => 'Bole',
            'currency' => 'ETB',
            'is_active' => true,
        ]);
        $cashier->update(['branch_id' => $branch->id]);
        $waiter->update(['branch_id' => $branch->id]);
        $category = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'name' => 'Hot Drinks',
            'slug' => 'hot-drinks',
            'is_active' => true,
        ]);
        $item = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $category->id,
            'name' => 'Espresso',
            'price' => 45,
            'preparation_department' => 'bar',
            'is_available' => true,
            'is_active' => true,
        ]);

        $this->actingAs($admin)->post('/dining-areas', [
            'name' => 'Garden',
            'is_active' => true,
        ])->assertRedirect();

        $areaId = DiningArea::query()->where('name', 'Garden')->value('id');

        $this->actingAs($admin)->post('/tables', [
            'dining_area_id' => $areaId,
            'table_number' => '12',
            'capacity' => 4,
            'status' => 'available',
            'is_active' => true,
        ])->assertRedirect();

        $this->actingAs($admin)->post('/tables', [
            'dining_area_id' => $areaId,
            'table_number' => '14',
            'capacity' => 2,
            'status' => 'available',
            'is_active' => true,
        ])->assertRedirect();

        $table = RestaurantTable::query()->where('table_number', '12')->firstOrFail();
        $other = RestaurantTable::query()->where('table_number', '14')->firstOrFail();

        $this->actingAs($waiter)->get('/pos')->assertOk();
        $this->actingAs($waiter)->post('/tables')->assertForbidden();

        $this->actingAs($waiter)->post('/pos/orders', [
            'order_type' => 'dine_in',
            'restaurant_table_id' => $table->id,
            'items' => [
                ['menu_item_id' => $item->id, 'quantity' => 1],
            ],
        ])->assertRedirect(route('pos.terminal'));

        $order = Order::query()->firstOrFail();
        $this->assertSame('occupied', $table->fresh()->status);
        $this->assertSame('Espresso', $order->items()->first()->name);
        $this->assertDatabaseHas('kitchen_bar_tickets', [
            'order_id' => $order->id,
            'department' => 'bar',
        ]);
        $this->assertTrue((float) $order->total_amount > 45);

        $line = $order->items()->first();
        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/add-items", [
            'items' => [
                ['menu_item_id' => $item->id, 'quantity' => 1],
            ],
        ])->assertOk();

        $extra = $order->items()->whereKeyNot($line->id)->first();
        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [
                ['order_item_id' => $line->id, 'quantity' => 2],
            ],
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertEquals(2, (float) $line->fresh()->quantity);
        $this->assertSame('cancelled', $extra->fresh()->status);

        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [
                ['order_item_id' => $line->id, 'quantity' => 1],
            ],
        ])->assertOk();

        $this->actingAs($waiter)->post("/orders/{$order->id}/settle", [
            'method' => 'cash',
            'amount_tendered' => 100,
        ])->assertForbidden();

        $this->actingAs($cashier)->post("/orders/{$order->id}/settle", [
            'method' => 'cash',
            'amount_tendered' => 100,
        ])->assertRedirect();

        $this->assertSame('completed', $order->fresh()->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('available', $table->fresh()->status);
        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'method' => 'cash',
        ]);

        $this->actingAs($cashier)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [
                ['order_item_id' => $line->id, 'quantity' => 3],
            ],
        ])->assertStatus(422);

        $this->actingAs($waiter)->post('/pos/orders', [
            'order_type' => 'dine_in',
            'restaurant_table_id' => $table->id,
            'items' => [
                ['menu_item_id' => $item->id, 'quantity' => 1],
            ],
        ])->assertRedirect();

        $second = Order::query()->where('status', 'in_preparation')->firstOrFail();
        $this->actingAs($waiter)->post("/tables/{$table->id}/transfer", [
            'target_table_id' => $other->id,
        ])->assertRedirect();

        $this->assertSame($other->id, $second->fresh()->restaurant_table_id);
        $this->assertSame('available', $table->fresh()->status);
        $this->assertSame('occupied', $other->fresh()->status);

        $this->actingAs($admin)->post("/orders/{$second->id}/cancel", [
            'reason' => 'Guest left',
        ])->assertRedirect();

        $this->assertSame('cancelled', $second->fresh()->status);
        $this->assertSame('available', $other->fresh()->status);
    }

    public function test_saving_an_edit_with_no_active_items_adds_the_test_product(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $waiter = User::factory()->create();
        $waiter->assignRole('waiter');
        $branch = Branch::query()->create([
            'code' => 'BOLE',
            'name' => 'Bole',
            'currency' => 'ETB',
            'is_active' => true,
        ]);
        $waiter->update(['branch_id' => $branch->id]);
        $category = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'name' => 'Hot Drinks',
            'slug' => 'hot-drinks',
            'is_active' => true,
        ]);
        $item = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $category->id,
            'name' => 'Espresso',
            'price' => 45,
            'preparation_department' => 'bar',
            'is_available' => true,
            'is_active' => true,
        ]);
        $area = DiningArea::query()->create([
            'branch_id' => $branch->id,
            'name' => 'Garden',
            'is_active' => true,
        ]);
        $table = RestaurantTable::query()->create([
            'branch_id' => $branch->id,
            'dining_area_id' => $area->id,
            'table_number' => '12',
            'capacity' => 4,
            'status' => 'available',
            'is_active' => true,
        ]);

        $this->actingAs($waiter)->post('/pos/orders', [
            'order_type' => 'dine_in',
            'restaurant_table_id' => $table->id,
            'items' => [
                ['menu_item_id' => $item->id, 'quantity' => 1],
            ],
        ])->assertRedirect();

        $order = Order::query()->firstOrFail();
        $line = $order->items()->firstOrFail();

        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [],
        ])->assertStatus(422);

        $this->assertSame('sent', $line->fresh()->status);

        MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $category->id,
            'name' => 'test-product',
            'price' => 0,
            'preparation_department' => 'kitchen',
            'is_available' => true,
            'is_active' => true,
        ]);

        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [],
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertSame('cancelled', $line->fresh()->status);
        $placeholder = $order->items()->where('status', '!=', 'cancelled')->firstOrFail();
        $this->assertSame('test-product', $placeholder->name);
        $this->assertEquals(0, (float) $placeholder->unit_price);
        $this->assertEquals(0, (float) $order->fresh()->total_amount);
    }
}
