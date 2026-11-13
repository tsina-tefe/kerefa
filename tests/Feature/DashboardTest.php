<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $this->actingAs($user = User::factory()->create());

        $this->get('/dashboard')->assertOk();
    }

    public function test_dashboard_reports_sales_for_the_active_branch(): void
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

        $order = Order::query()->create([
            'branch_id' => $branch->id,
            'order_number' => 'ORD-TEST-1',
            'status' => 'completed',
            'payment_status' => 'paid',
            'total_amount' => 250,
            'amount_paid' => 250,
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'branch_id' => $branch->id,
            'method' => 'cash',
            'amount' => 250,
            'paid_at' => now(),
        ]);

        $cancelled = Order::query()->create([
            'branch_id' => $branch->id,
            'order_number' => 'ORD-TEST-2',
            'status' => 'cancelled',
        ]);
        $cancelled->statusHistory()->create([
            'status_from' => 'in_preparation',
            'status_to' => 'cancelled',
        ]);

        $this->actingAs($admin)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('insights.branch', 'Bole')
            ->where('insights.daily_sales', 250)
            ->where('insights.weekly_sales', 250)
            ->where('insights.cancelled_orders', 1)
            ->has('insights.trend', 7));
    }
}
