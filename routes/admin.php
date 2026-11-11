<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BranchContextController;
use App\Http\Controllers\Admin\BranchController;
use App\Http\Controllers\Admin\DepartmentController;
use App\Http\Controllers\Admin\OrderStationController;
use App\Http\Controllers\Admin\PermissionController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SystemSettingController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ModulePlaceholderController;
use Illuminate\Support\Facades\Route;

Route::post('branches/switch', [BranchContextController::class, 'switch'])->name('branches.switch');

Route::get('users', [UserController::class, 'index'])->name('users.index');
Route::get('users/create', [UserController::class, 'create'])->name('users.create');
Route::post('users', [UserController::class, 'store'])->name('users.store');
Route::get('users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
Route::post('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');

Route::get('roles', [RoleController::class, 'index'])->name('roles.index');
Route::get('roles/create', [RoleController::class, 'create'])->name('roles.create');
Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
Route::get('roles/{role}/edit', [RoleController::class, 'edit'])->name('roles.edit');
Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');

Route::get('permissions', [PermissionController::class, 'index'])->name('permissions.index');
Route::post('permissions', [PermissionController::class, 'store'])->name('permissions.store');
Route::put('permissions/{permission}', [PermissionController::class, 'update'])->name('permissions.update');
Route::delete('permissions/{permission}', [PermissionController::class, 'destroy'])->name('permissions.destroy');

Route::get('departments', [DepartmentController::class, 'index'])->name('departments.index');
Route::get('departments/create', [DepartmentController::class, 'create'])->name('departments.create');
Route::post('departments', [DepartmentController::class, 'store'])->name('departments.store');
Route::get('departments/{department}/edit', [DepartmentController::class, 'edit'])->name('departments.edit');
Route::put('departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');

Route::get('branches', [BranchController::class, 'index'])->name('branches.index');
Route::get('branches/create', [BranchController::class, 'create'])->name('branches.create');
Route::post('branches', [BranchController::class, 'store'])->name('branches.store');
Route::get('branches/{branch}/edit', [BranchController::class, 'edit'])->name('branches.edit');
Route::put('branches/{branch}', [BranchController::class, 'update'])->name('branches.update');
Route::delete('branches/{branch}', [BranchController::class, 'destroy'])->name('branches.destroy');
Route::post('branches/{branch}/departments', [BranchController::class, 'storeDepartment'])->name('branches.departments.store');

Route::get('system-settings', [SystemSettingController::class, 'index'])->name('settings.index');
Route::put('system-settings', [SystemSettingController::class, 'update'])->name('settings.update');

Route::get('stations', [OrderStationController::class, 'index'])->name('stations.index');
Route::post('stations', [OrderStationController::class, 'store'])->name('stations.store');
Route::put('stations/{station}', [OrderStationController::class, 'update'])->name('stations.update');
Route::post('stations/{station}/toggle', [OrderStationController::class, 'toggle'])->name('stations.toggle');
Route::delete('stations/{station}', [OrderStationController::class, 'destroy'])->name('stations.destroy');

Route::get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');

Route::get('menu', ModulePlaceholderController::class)->name('menu.index')->defaults('title', 'Menu & Products');
Route::get('tables', ModulePlaceholderController::class)->name('tables.index')->defaults('title', 'Table Floor Plan');
Route::get('orders', ModulePlaceholderController::class)->name('orders.index')->defaults('title', 'Orders');
Route::get('pos', ModulePlaceholderController::class)->name('pos.terminal')->defaults('title', 'POS Terminal');
Route::get('inventory', ModulePlaceholderController::class)->name('inventory.index')->defaults('title', 'Stock & Inventory');
Route::get('procurement', ModulePlaceholderController::class)->name('procurement.index')->defaults('title', 'Procurement');
