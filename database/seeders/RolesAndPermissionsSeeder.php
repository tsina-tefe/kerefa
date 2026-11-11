<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Seed roles and permissions for administration, POS, and supply chain.
     */
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            ['module' => 'users', 'name' => 'users.view', 'description' => 'View list of system users'],
            ['module' => 'users', 'name' => 'users.create', 'description' => 'Create new system users'],
            ['module' => 'users', 'name' => 'users.edit', 'description' => 'Modify existing user details and statuses'],
            ['module' => 'users', 'name' => 'users.delete', 'description' => 'Remove or deactivate system users'],

            ['module' => 'roles', 'name' => 'roles.view', 'description' => 'View roles and their assigned permissions'],
            ['module' => 'roles', 'name' => 'roles.manage', 'description' => 'Create and modify roles and permission mappings'],

            ['module' => 'permissions', 'name' => 'permissions.view', 'description' => 'View system permissions'],
            ['module' => 'permissions', 'name' => 'permissions.manage', 'description' => 'Create, edit, and delete permissions'],

            ['module' => 'branches', 'name' => 'branches.view', 'description' => 'View branch details'],
            ['module' => 'branches', 'name' => 'branches.manage', 'description' => 'Create and configure branches'],
            ['module' => 'branches', 'name' => 'branches.switch', 'description' => 'Switch the active operational branch'],

            ['module' => 'departments', 'name' => 'departments.view', 'description' => 'View departments'],
            ['module' => 'departments', 'name' => 'departments.manage', 'description' => 'Create, edit, and delete departments'],

            ['module' => 'settings', 'name' => 'settings.view', 'description' => 'View system configurations'],
            ['module' => 'settings', 'name' => 'settings.manage', 'description' => 'Modify system settings and station mapping'],
            ['module' => 'settings', 'name' => 'audit.view', 'description' => 'Inspect the system audit trail'],

            ['module' => 'pos', 'name' => 'pos.view', 'description' => 'Access the POS terminal and tables'],
            ['module' => 'pos', 'name' => 'pos.orders.create', 'description' => 'Take new dine-in, takeaway, and delivery orders'],
            ['module' => 'pos', 'name' => 'pos.orders.edit', 'description' => 'Modify existing open orders'],
            ['module' => 'pos', 'name' => 'pos.orders.cancel', 'description' => 'Cancel orders or items'],
            ['module' => 'pos', 'name' => 'pos.orders.settle', 'description' => 'Take payment and settle orders'],
            ['module' => 'pos', 'name' => 'pos.tables.manage', 'description' => 'Configure dining areas and tables'],
            ['module' => 'pos', 'name' => 'pos.menu.manage', 'description' => 'Manage menu items, prices, and categories'],
            ['module' => 'pos', 'name' => 'pos.kds.view', 'description' => 'Access kitchen tickets'],
            ['module' => 'pos', 'name' => 'pos.bds.view', 'description' => 'Access bar tickets'],

            ['module' => 'inventory', 'name' => 'inventory.view', 'description' => 'View stock items, balances, and locations'],
            ['module' => 'inventory', 'name' => 'inventory.manage', 'description' => 'Create and modify stock items and units'],
            ['module' => 'inventory', 'name' => 'inventory.transfer', 'description' => 'Initiate and receive internal stock transfers'],
            ['module' => 'inventory', 'name' => 'inventory.adjust', 'description' => 'Record stock adjustments and wastage'],
            ['module' => 'inventory', 'name' => 'inventory.count', 'description' => 'Perform physical stock counts'],

            ['module' => 'procurement', 'name' => 'procurement.view', 'description' => 'View purchase orders and vendors'],
            ['module' => 'procurement', 'name' => 'procurement.requests', 'description' => 'Create and submit purchase requests'],
            ['module' => 'procurement', 'name' => 'procurement.orders', 'description' => 'Generate and approve purchase orders'],
            ['module' => 'procurement', 'name' => 'procurement.receiving', 'description' => 'Receive goods and update stock'],

            ['module' => 'recipes', 'name' => 'recipes.view', 'description' => 'View recipes that link menu items to stock'],
            ['module' => 'recipes', 'name' => 'recipes.manage', 'description' => 'Create and modify recipes and portions'],

            ['module' => 'reports', 'name' => 'reports.view', 'description' => 'Access operational reports'],
            ['module' => 'reports', 'name' => 'reports.export', 'description' => 'Export reports to PDF or Excel'],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(
                ['name' => $permission['name'], 'guard_name' => 'web'],
                [
                    'module' => $permission['module'],
                    'description' => $permission['description'],
                ],
            );
        }

        $all = array_column($permissions, 'name');

        $roles = [
            'super-admin' => [
                'label' => 'Super Administrator',
                'description' => 'Full access to administration, POS, and supply chain',
                'is_system' => true,
                'permissions' => $all,
            ],
            'general-manager' => [
                'label' => 'General Manager',
                'description' => 'Oversight across branches, with approvals and reports',
                'is_system' => true,
                'permissions' => [
                    'users.view', 'departments.view', 'branches.view', 'branches.switch', 'settings.view', 'audit.view',
                    'pos.view', 'pos.orders.create', 'pos.orders.edit', 'pos.orders.cancel', 'pos.orders.settle', 'pos.tables.manage', 'pos.menu.manage',
                    'inventory.view', 'inventory.manage', 'inventory.transfer', 'inventory.adjust', 'inventory.count',
                    'procurement.view', 'procurement.orders',
                    'recipes.view',
                    'reports.view', 'reports.export',
                ],
            ],
            'branch-manager' => [
                'label' => 'Branch Manager',
                'description' => 'Operational control within the assigned branch',
                'is_system' => true,
                'permissions' => [
                    'users.view', 'departments.view', 'branches.view', 'branches.switch',
                    'pos.view', 'pos.orders.create', 'pos.orders.edit', 'pos.orders.cancel', 'pos.orders.settle', 'pos.tables.manage', 'pos.menu.manage',
                    'pos.kds.view', 'pos.bds.view',
                    'inventory.view', 'inventory.transfer', 'inventory.adjust', 'inventory.count',
                    'procurement.view', 'procurement.requests', 'procurement.receiving',
                    'recipes.view',
                    'reports.view',
                ],
            ],
            'cashier' => [
                'label' => 'Cashier',
                'description' => 'POS orders and settlement',
                'is_system' => true,
                'permissions' => [
                    'pos.view', 'pos.orders.create', 'pos.orders.edit', 'pos.orders.settle', 'reports.view',
                ],
            ],
            'waiter' => [
                'label' => 'Waiter',
                'description' => 'Table orders and service updates',
                'is_system' => true,
                'permissions' => [
                    'pos.view', 'pos.orders.create', 'pos.orders.edit',
                ],
            ],
            'kitchen-staff' => [
                'label' => 'Kitchen Staff',
                'description' => 'Kitchen tickets and preparation status',
                'is_system' => true,
                'permissions' => [
                    'pos.kds.view', 'recipes.view',
                ],
            ],
            'bar-staff' => [
                'label' => 'Bar Staff',
                'description' => 'Bar tickets and beverage preparation status',
                'is_system' => true,
                'permissions' => [
                    'pos.bds.view', 'recipes.view',
                ],
            ],
            'storekeeper' => [
                'label' => 'Storekeeper',
                'description' => 'Stock receipts, issues, transfers, and counts',
                'is_system' => true,
                'permissions' => [
                    'inventory.view', 'inventory.manage', 'inventory.transfer', 'inventory.adjust', 'inventory.count',
                    'procurement.view', 'procurement.receiving',
                    'reports.view',
                ],
            ],
            'procurement-officer' => [
                'label' => 'Procurement Officer',
                'description' => 'Suppliers, requisitions, and purchase orders',
                'is_system' => true,
                'permissions' => [
                    'procurement.view', 'procurement.requests', 'procurement.orders', 'procurement.receiving',
                    'inventory.view', 'reports.view',
                ],
            ],
        ];

        foreach ($roles as $name => $data) {
            $role = Role::updateOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                [
                    'label' => $data['label'],
                    'description' => $data['description'],
                    'is_system' => $data['is_system'],
                ],
            );

            $role->syncPermissions($data['permissions']);
        }
    }
}
