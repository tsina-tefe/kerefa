<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingController extends Controller
{
    public function __construct(protected AuditLogService $auditLog) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('settings.view'), 403);

        $settings = SystemSetting::query()
            ->whereNull('branch_id')
            ->orderBy('category')
            ->orderBy('key')
            ->get();

        return Inertia::render('admin/settings/index', [
            'settings' => $settings,
            'canManage' => $request->user()->can('settings.manage'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $values = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*' => ['nullable', 'string', 'max:1000'],
        ])['settings'];

        if (($values['bill_generation_enabled'] ?? '0') === '1') {
            return back()->with('error', __('Customer bill generation stays off in this release.'));
        }

        foreach ($values as $key => $value) {
            $setting = SystemSetting::query()->whereNull('branch_id')->where('key', $key)->first();

            if ($setting) {
                $setting->update(['value' => $value]);
            }
        }

        $this->auditLog->log('update', 'settings', 'Updated system settings');

        return back()->with('success', __('Settings saved.'));
    }
}
