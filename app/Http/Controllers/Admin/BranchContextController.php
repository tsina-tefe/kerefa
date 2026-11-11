<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use App\Services\BranchContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BranchContextController extends Controller
{
    public function __construct(
        protected BranchContextService $branchContext,
        protected AuditLogService $auditLog,
    ) {}

    public function switch(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('branches.switch'), 403);

        $validated = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
        ]);

        if (! $this->branchContext->setActiveBranch((int) $validated['branch_id'], $request->user())) {
            return back()->with('error', __('You cannot open that branch.'));
        }

        $branch = $this->branchContext->getActiveBranch($request->user());

        $this->auditLog->log(
            action: 'branch_switch',
            module: 'branches',
            description: "Switched active branch to {$branch?->name}",
            record: $branch,
            branchId: $branch?->id,
        );

        return back()->with('success', __('Switched to :branch.', ['branch' => $branch?->name]));
    }
}
