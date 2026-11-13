<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Services\BranchContextService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, BranchContextService $branches): Response
    {
        $branch = $branches->getActiveBranch($request->user());
        $branchId = $branch?->id;

        $payments = Payment::query()->when($branchId, fn ($query) => $query->where('branch_id', $branchId));
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        $weekStart = now()->startOfWeek();

        $dailySales = (float) (clone $payments)->where('paid_at', '>=', $today)->sum('amount');
        $paidOrders = (int) (clone $payments)->where('paid_at', '>=', $today)->count();
        $yesterdaySales = (float) (clone $payments)->whereBetween('paid_at', [$yesterday, $today])->sum('amount');
        $weeklySales = (float) (clone $payments)->where('paid_at', '>=', $weekStart)->sum('amount');

        $trendStart = now()->subDays(6)->startOfDay();
        $totals = Payment::query()
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->where('paid_at', '>=', $trendStart)
            ->selectRaw('DATE(paid_at) as sale_day, SUM(amount) as total')
            ->groupBy('sale_day')
            ->get()
            ->mapWithKeys(fn ($row) => [Carbon::parse($row->sale_day)->toDateString() => (float) $row->total]);

        $trend = collect(range(6, 0))->map(function (int $daysAgo) use ($totals) {
            $day = now()->subDays($daysAgo);

            return [
                'label' => $day->format('D'),
                'amount' => round((float) ($totals[$day->toDateString()] ?? 0), 2),
            ];
        })->all();

        return Inertia::render('dashboard', [
            'insights' => [
                'branch' => $branch?->name,
                'daily_sales' => round($dailySales, 2),
                'weekly_sales' => round($weeklySales, 2),
                'yesterday_sales' => round($yesterdaySales, 2),
                'change_percent' => $yesterdaySales > 0 ? round((($dailySales - $yesterdaySales) / $yesterdaySales) * 100, 1) : null,
                'average_ticket' => $paidOrders > 0 ? round($dailySales / $paidOrders, 2) : 0,
                'paid_orders' => $paidOrders,
                'open_orders' => Order::query()
                    ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
                    ->where('status', 'in_preparation')
                    ->count(),
                'cancelled_orders' => Order::query()
                    ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
                    ->where('status', 'cancelled')
                    ->whereHas('statusHistory', fn ($query) => $query
                        ->where('status_to', 'cancelled')
                        ->where('created_at', '>=', $today))
                    ->count(),
                'low_stock' => InventoryStock::query()
                    ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
                    ->whereColumn('current_stock', '<=', 'min_stock_level')
                    ->count(),
                'pending_orders' => PurchaseOrder::query()
                    ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
                    ->where('status', 'pending')
                    ->count(),
                'trend' => $trend,
            ],
        ]);
    }
}
