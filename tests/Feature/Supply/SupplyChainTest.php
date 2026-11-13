<?php

namespace Tests\Feature\Supply;

use App\Models\Branch;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryStock;
use App\Models\PurchaseOrder;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplyChainTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_can_be_received_through_a_purchase_order(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('super-admin');
        $waiter = User::factory()->create();
        $waiter->assignRole('waiter');

        Branch::query()->create([
            'code' => 'BOLE',
            'name' => 'Bole',
            'currency' => 'ETB',
            'is_active' => true,
        ]);

        $this->actingAs($waiter)->get('/inventory')->assertForbidden();

        $this->actingAs($admin)->post('/inventory-categories', [
            'name' => 'Dry godos',
        ])->assertRedirect();

        $this->actingAs($admin)->put('/inventory-categories/1', [
            'name' => 'Dry goods',
        ])->assertRedirect();
        $this->assertSame('Dry goods', InventoryCategory::query()->value('name'));

        $this->actingAs($admin)->post('/inventory', [
            'category_id' => 1,
            'code' => 'COFFEE',
            'name' => 'Coffee beans',
            'unit' => 'kg',
            'unit_cost' => 400,
            'min_stock_level' => 2,
        ])->assertRedirect();

        $item = InventoryItem::query()->where('code', 'COFFEE')->firstOrFail();

        $this->actingAs($admin)->post("/inventory/{$item->id}/adjust", [
            'type' => 'out',
            'quantity' => 1,
        ])->assertSessionHasErrors('quantity');

        $this->actingAs($admin)->post("/inventory/{$item->id}/adjust", [
            'type' => 'in',
            'quantity' => 5,
            'notes' => 'Opening balance',
        ])->assertRedirect();

        $this->assertEquals('5.0000', InventoryStock::query()->where('inventory_item_id', $item->id)->value('current_stock'));

        $this->actingAs($admin)->post('/procurement/suppliers', [
            'name' => 'Addis Coffee',
            'phone' => '0911000000',
        ])->assertRedirect();

        $this->actingAs($admin)->post('/procurement/orders', [
            'supplier_id' => 1,
            'notes' => 'Weekly delivery',
            'items' => [
                ['inventory_item_id' => $item->id, 'quantity' => 3, 'unit_cost' => 420],
            ],
        ])->assertRedirect();

        $order = PurchaseOrder::query()->firstOrFail();
        $this->assertSame('pending', $order->status);
        $this->assertEquals('1260.0000', $order->total_amount);

        $this->actingAs($admin)->post("/procurement/orders/{$order->id}/receive")->assertRedirect();

        $order->refresh();
        $item->refresh();
        $this->assertSame('received', $order->status);
        $this->assertEquals('8.0000', InventoryStock::query()->where('inventory_item_id', $item->id)->value('current_stock'));
        $this->assertEquals('420.0000', $item->unit_cost);

        $this->actingAs($admin)->get('/inventory')->assertOk()->assertSee('Coffee beans');
        $this->actingAs($admin)->get('/procurement')->assertOk()->assertSee($order->po_number);
    }
}
