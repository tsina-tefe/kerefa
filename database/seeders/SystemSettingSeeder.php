<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['category' => 'general', 'key' => 'app_name', 'value' => 'Kerefa', 'type' => 'string', 'description' => 'Name shown across the system'],
            ['category' => 'general', 'key' => 'currency_code', 'value' => 'ETB', 'type' => 'string', 'description' => 'Base currency code'],
            ['category' => 'general', 'key' => 'currency_symbol', 'value' => 'Br', 'type' => 'string', 'description' => 'Currency symbol'],
            ['category' => 'general', 'key' => 'timezone', 'value' => 'Africa/Addis_Ababa', 'type' => 'string', 'description' => 'Default timezone'],
            ['category' => 'pos', 'key' => 'vat_rate', 'value' => '15.00', 'type' => 'string', 'description' => 'VAT rate percentage'],
            ['category' => 'pos', 'key' => 'service_charge_rate', 'value' => '10.00', 'type' => 'string', 'description' => 'Service charge percentage'],
            ['category' => 'pos', 'key' => 'bill_generation_enabled', 'value' => '0', 'type' => 'boolean', 'description' => 'Customer bill printing. Stays off in this release.'],
        ];

        foreach ($settings as $setting) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $setting['key']],
                [...$setting, 'branch_id' => null],
            );
        }
    }
}
