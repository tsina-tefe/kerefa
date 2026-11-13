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
use App\Http\Controllers\Pos\MenuController;
use App\Http\Controllers\Pos\OrderController;
use App\Http\Controllers\Pos\PosController;
use App\Http\Controllers\Pos\TableController;
use App\Http\Controllers\Supply\InventoryController;
use App\Http\Controllers\Supply\ProcurementController;
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

Route::get('menu', [MenuController::class, 'index'])->name('menu.index');
Route::get('menu/create', [MenuController::class, 'create'])->name('menu.create');
Route::post('menu', [MenuController::class, 'store'])->name('menu.store');
Route::get('menu/{menuItem}/edit', [MenuController::class, 'edit'])->name('menu.edit');
Route::put('menu/{menuItem}', [MenuController::class, 'update'])->name('menu.update');
Route::delete('menu/{menuItem}', [MenuController::class, 'destroy'])->name('menu.destroy');
Route::post('menu/{menuItem}/toggle-availability', [MenuController::class, 'toggleAvailability'])->name('menu.toggle-availability');
Route::post('menu/{menuItem}/toggle-favorite', [MenuController::class, 'toggleFavorite'])->name('menu.toggle-favorite');
Route::post('menu-categories', [MenuController::class, 'storeCategory'])->name('menu-categories.store');
Route::put('menu-categories/{menuCategory}', [MenuController::class, 'updateCategory'])->name('menu-categories.update');
Route::delete('menu-categories/{menuCategory}', [MenuController::class, 'destroyCategory'])->name('menu-categories.destroy');
Route::get('tables', [TableController::class, 'index'])->name('tables.index');
Route::post('dining-areas', [TableController::class, 'storeArea'])->name('dining-areas.store');
Route::put('dining-areas/{diningArea}', [TableController::class, 'updateArea'])->name('dining-areas.update');
Route::delete('dining-areas/{diningArea}', [TableController::class, 'destroyArea'])->name('dining-areas.destroy');
Route::post('tables', [TableController::class, 'store'])->name('tables.store');
Route::put('tables/{restaurantTable}', [TableController::class, 'update'])->name('tables.update');
Route::delete('tables/{restaurantTable}', [TableController::class, 'destroy'])->name('tables.destroy');
Route::post('tables/{restaurantTable}/transfer', [TableController::class, 'transfer'])->name('tables.transfer');
Route::post('tables/{restaurantTable}/merge', [TableController::class, 'merge'])->name('tables.merge');

Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
Route::post('orders/{order}/items', [OrderController::class, 'addItems'])->name('orders.items.store');
Route::post('orders/{order}/settle', [OrderController::class, 'settle'])->name('orders.settle');
Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');

Route::get('pos', [PosController::class, 'terminal'])->name('pos.terminal');
Route::post('pos/orders', [PosController::class, 'storeOrder'])->name('pos.orders.store');
Route::post('pos/orders/{order}/add-items', [OrderController::class, 'addItems'])->name('pos.orders.add-items');
Route::post('pos/orders/{order}/edit', [OrderController::class, 'updateOpen'])->name('pos.orders.update');
Route::post('pos/orders/{order}/settle', [OrderController::class, 'settle'])->name('pos.orders.settle.json');
Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
Route::post('inventory-categories', [InventoryController::class, 'storeCategory'])->name('inventory-categories.store');
Route::put('inventory-categories/{inventoryCategory}', [InventoryController::class, 'updateCategory'])->name('inventory-categories.update');
Route::post('inventory', [InventoryController::class, 'storeItem'])->name('inventory.store');
Route::post('inventory/{item}/adjust', [InventoryController::class, 'adjust'])->name('inventory.adjust');

Route::get('procurement', [ProcurementController::class, 'index'])->name('procurement.index');
Route::post('procurement/suppliers', [ProcurementController::class, 'storeSupplier'])->name('procurement.suppliers.store');
Route::post('procurement/orders', [ProcurementController::class, 'storeOrder'])->name('procurement.orders.store');
Route::post('procurement/orders/{purchaseOrder}/receive', [ProcurementController::class, 'receive'])->name('procurement.orders.receive');
