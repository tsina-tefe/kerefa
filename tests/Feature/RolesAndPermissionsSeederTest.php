<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolesAndPermissionsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_can_settle_orders_and_cannot_adjust_stock(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->assertTrue($cashier->can('pos.orders.settle'));
        $this->assertFalse($cashier->can('inventory.adjust'));
    }
}
