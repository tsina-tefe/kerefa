<?php

namespace App\Http\Middleware;

use App\Services\BranchContextService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * @var string
     */
    protected $rootView = 'app';

    public function __construct(protected BranchContextService $branchContext) {}

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');
        $user = $request->user();
        $currentBranch = $user ? $this->branchContext->getActiveBranch($user) : null;

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $user,
                'permissions' => $user ? $user->getAllPermissions()->pluck('name')->values() : [],
                'roles' => $user ? $user->getRoleNames()->values() : [],
            ],
            'currentBranch' => $currentBranch ? [
                'id' => $currentBranch->id,
                'name' => $currentBranch->name,
                'code' => $currentBranch->code,
            ] : null,
            'accessibleBranches' => $user
                ? $this->branchContext->getAccessibleBranches($user)->map(fn ($branch) => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'code' => $branch->code,
                ])->values()
                : [],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
