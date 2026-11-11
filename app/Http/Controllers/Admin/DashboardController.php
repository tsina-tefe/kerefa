<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\OrderStation;
use App\Models\User;
use App\Services\BranchContextService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, BranchContextService $branches): Response
    {
        $branchId = $branches->getActiveBranchId($request->user());

        return Inertia::render('dashboard', [
            'stats' => [
                'users' => User::query()->count(),
                'branches' => Branch::query()->count(),
                'stations' => OrderStation::query()->when($branchId, fn ($query) => $query->where('branch_id', $branchId))->count(),
                'menu_items' => MenuItem::query()->count(),
            ],
        ]);
    }
}
