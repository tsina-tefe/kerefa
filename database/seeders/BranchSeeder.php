<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Department;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $branch = Branch::query()->updateOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Branch',
                'address' => 'Addis Ababa',
                'is_main' => true,
                'is_active' => true,
                'currency' => 'ETB',
            ],
        );

        Department::query()->updateOrCreate(
            ['branch_id' => $branch->id, 'code' => 'KIT'],
            ['name' => 'Kitchen', 'type' => 'kitchen', 'is_active' => true],
        );

        Department::query()->updateOrCreate(
            ['branch_id' => $branch->id, 'code' => 'BAR'],
            ['name' => 'Bar', 'type' => 'bar', 'is_active' => true],
        );
    }
}
