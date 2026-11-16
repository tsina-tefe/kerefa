<?php

namespace Tests\Feature\Pos;

use App\Models\Branch;
use App\Models\DiningArea;
use App\Models\KitchenBarTicket;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderStation;
use App\Models\RestaurantTable;
use App\Models\TicketItem;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
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
        $this->assertSame('voided', $extra->fresh()->status);

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

    public function test_editing_prints_separate_void_and_quantity_change_tickets(): void
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
                ['menu_item_id' => $item->id, 'quantity' => 2],
                ['menu_item_id' => $item->id, 'quantity' => 1],
            ],
        ])->assertRedirect();

        $order = Order::query()->firstOrFail();
        $kept = $order->items()->orderBy('id')->first();
        $voided = $order->items()->orderBy('id')->skip(1)->first();
        $originalTicketQty = TicketItem::query()->where('order_item_id', $kept->id)->sum('quantity');

        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [
                ['order_item_id' => $kept->id, 'quantity' => 3],
            ],
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertEquals(3, (float) $kept->fresh()->quantity);
        $this->assertSame('voided', $voided->fresh()->status);
        $this->assertEquals($originalTicketQty, (float) TicketItem::query()->where('order_item_id', $kept->id)->orderBy('id')->value('quantity'));

        $qtyChange = TicketItem::query()
            ->where('order_item_id', $kept->id)
            ->where('status', 'queued')
            ->orderByDesc('id')
            ->first();
        $this->assertEquals(1, (float) $qtyChange->quantity);

        $voidTicketItem = TicketItem::query()
            ->where('order_item_id', $voided->id)
            ->where('status', 'voided')
            ->latest('id')
            ->first();
        $this->assertNotNull($voidTicketItem);
        $this->assertEquals(-1, (float) $voidTicketItem->quantity);
        $this->assertNotEquals($qtyChange->ticket_id, $voidTicketItem->ticket_id);

        $this->actingAs($waiter)->postJson("/pos/orders/{$order->id}/edit", [
            'lines' => [
                ['order_item_id' => $kept->id, 'quantity' => 1],
            ],
        ])->assertOk();

        $decrease = TicketItem::query()
            ->where('order_item_id', $kept->id)
            ->orderByDesc('id')
            ->first();
        $this->assertEquals(-2, (float) $decrease->quantity);
        $this->assertSame('queued', $decrease->status);
        $this->assertSame('sent', $kept->fresh()->status);
        $this->assertEquals(4, KitchenBarTicket::query()->where('order_id', $order->id)->count());
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

        $this->assertSame('voided', $line->fresh()->status);
        $placeholder = $order->items()->active()->firstOrFail();
        $this->assertSame('test-product', $placeholder->name);
        $this->assertEquals(0, (float) $placeholder->unit_price);
        $this->assertEquals(0, (float) $order->fresh()->total_amount);
    }

    public function test_orders_can_be_filtered_by_a_date_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');
        $branch = Branch::query()->create([
            'code' => 'BOLE',
            'name' => 'Bole',
            'currency' => 'ETB',
            'is_active' => true,
        ]);

        $older = Order::query()->create([
            'branch_id' => $branch->id,
            'order_number' => 'ORD-OLD',
            'total_amount' => 100,
        ]);
        $older->forceFill(['created_at' => '2026-11-01 10:00:00'])->save();

        Order::query()->create([
            'branch_id' => $branch->id,
            'order_number' => 'ORD-NEW',
            'total_amount' => 250,
        ])->forceFill(['created_at' => '2026-11-13 10:00:00'])->save();

        $this->actingAs($admin)
            ->get('/orders?date_from=2026-11-13&date_to=2026-11-01')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('pos/orders/index')
                ->where('filters.date_from', '2026-11-01')
                ->where('filters.date_to', '2026-11-13')
                ->where('grand_total', 350)
                ->has('orders.data', 2));

        $this->actingAs($admin)
            ->get('/orders?date_from=2026-11-13&date_to=2026-11-13')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.order_number', 'ORD-NEW')
                ->where('grand_total', 250));

        $this->actingAs($admin)
            ->get('/orders')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('grand_total', null));
    }

    public function test_an_order_prints_one_ticket_per_station_not_per_category(): void
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

        $kitchen = OrderStation::query()->create([
            'branch_id' => $branch->id,
            'name' => 'Hot Kitchen',
            'code' => 'HOT',
            'station_type' => 'kitchen',
            'is_active' => true,
        ]);
        $bar = OrderStation::query()->create([
            'branch_id' => $branch->id,
            'name' => 'Bar',
            'code' => 'BAR',
            'station_type' => 'bar',
            'is_active' => true,
        ]);

        $breakfast = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Breakfast',
            'slug' => 'breakfast',
            'is_active' => true,
        ]);
        $lunch = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Lunch',
            'slug' => 'lunch',
            'is_active' => true,
        ]);
        $combo = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Combo',
            'slug' => 'combo',
            'is_active' => true,
        ]);
        $coffee = MenuCategory::query()->create([
            'branch_id' => $branch->id,
            'order_station_id' => $bar->id,
            'name' => 'Coffee',
            'slug' => 'coffee',
            'is_active' => true,
        ]);

        $chechebesa = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $breakfast->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Chechebesa Special',
            'price' => 400,
            'preparation_department' => 'kitchen',
            'is_available' => true,
            'is_active' => true,
        ]);
        $kitfo = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $lunch->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Kitfo',
            'price' => 930,
            'preparation_department' => 'kitchen',
            'is_available' => true,
            'is_active' => true,
        ]);
        $shiroTibs = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $combo->id,
            'order_station_id' => $kitchen->id,
            'name' => 'Shiro with Tibs',
            'price' => 825,
            'preparation_department' => 'kitchen',
            'is_available' => true,
            'is_active' => true,
        ]);
        $buna = MenuItem::query()->create([
            'branch_id' => $branch->id,
            'category_id' => $coffee->id,
            'order_station_id' => $bar->id,
            'name' => 'Buna',
            'price' => 60,
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

        $response = $this->actingAs($waiter)->postJson('/pos/orders', [
            'order_type' => 'dine_in',
            'restaurant_table_id' => $table->id,
            'items' => [
                ['menu_item_id' => $chechebesa->id, 'quantity' => 1],
                ['menu_item_id' => $kitfo->id, 'quantity' => 1],
                ['menu_item_id' => $shiroTibs->id, 'quantity' => 1],
                ['menu_item_id' => $buna->id, 'quantity' => 2],
            ],
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertCount(2, $response->json('order.tickets'));
        $this->assertEquals(2, KitchenBarTicket::query()->count());

        $kitchenTicket = collect($response->json('order.tickets'))->firstWhere('order_station_id', $kitchen->id);
        $barTicket = collect($response->json('order.tickets'))->firstWhere('order_station_id', $bar->id);

        $this->assertNotNull($kitchenTicket);
        $this->assertNotNull($barTicket);
        $this->assertNotSame($kitchenTicket['ticket_number'], $barTicket['ticket_number']);
        $this->assertCount(3, $kitchenTicket['items']);
        $this->assertCount(1, $barTicket['items']);

        $kitchenNames = collect($kitchenTicket['items'])->map(fn ($row) => $row['order_item']['name'])->sort()->values()->all();
        $this->assertSame(['Chechebesa Special', 'Kitfo', 'Shiro with Tibs'], $kitchenNames);
        $this->assertSame('Buna', $barTicket['items'][0]['order_item']['name']);
        $this->assertEquals(2, (float) $barTicket['items'][0]['quantity']);
    }
}
