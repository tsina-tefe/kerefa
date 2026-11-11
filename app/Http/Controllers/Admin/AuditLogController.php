<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->can('audit.view'), 403);

        $module = $request->string('module')->toString();
        $search = $request->string('search')->toString();

        $logs = AuditLog::query()
            ->with(['user:id,name,username', 'branch:id,name,code'])
            ->when($module !== '', fn ($query) => $query->where('module', $module))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('description', 'like', "%{$search}%")
                        ->orWhere('action', 'like', "%{$search}%");
                });
            })
            ->latest('created_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('admin/audit/index', [
            'logs' => $logs,
            'modules' => AuditLog::query()->distinct()->orderBy('module')->pluck('module'),
            'filters' => [
                'module' => $module,
                'search' => $search,
            ],
        ]);
    }
}
