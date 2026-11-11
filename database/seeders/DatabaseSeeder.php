<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            BranchSeeder::class,
            SystemSettingSeeder::class,
        ]);

        $branchId = Branch::query()->where('code', 'MAIN')->value('id');

        $user = User::query()->firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'username' => 'admin',
                'password' => 'password',
                'is_active' => true,
                'branch_id' => $branchId,
            ],
        );

        $user->forceFill([
            'username' => $user->username ?: 'admin',
            'branch_id' => $user->branch_id ?: $branchId,
            'is_active' => true,
        ])->save();

        $user->assignRole('super-admin');
    }
}
