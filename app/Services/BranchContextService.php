<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class BranchContextService
{
    public const SESSION_KEY = 'kerefa_active_branch_id';

    public function getActiveBranchId(?User $user = null): ?int
    {
        $sessionBranchId = session(self::SESSION_KEY);

        if ($sessionBranchId && $user && $user->canAccessBranch((int) $sessionBranchId)) {
            return (int) $sessionBranchId;
        }

        if ($user?->branch_id && $user->canAccessBranch($user->branch_id)) {
            session([self::SESSION_KEY => $user->branch_id]);

            return (int) $user->branch_id;
        }

        $fallback = $this->getAccessibleBranches($user)->first();

        if ($fallback) {
            session([self::SESSION_KEY => $fallback->id]);

            return (int) $fallback->id;
        }

        return null;
    }

    public function getActiveBranch(?User $user = null): ?Branch
    {
        $branchId = $this->getActiveBranchId($user);

        return $branchId ? Branch::find($branchId) : null;
    }

    public function setActiveBranch(int $branchId, User $user): bool
    {
        if (! $user->canAccessBranch($branchId)) {
            return false;
        }

        $branch = Branch::query()->whereKey($branchId)->where('is_active', true)->first();

        if (! $branch) {
            return false;
        }

        session([self::SESSION_KEY => $branch->id]);

        return true;
    }

    /**
     * @return Collection<int, Branch>
     */
    public function getAccessibleBranches(?User $user): Collection
    {
        if (! $user) {
            return new Collection;
        }

        if ($user->isSuperAdmin()) {
            return Branch::query()->where('is_active', true)->orderBy('name')->get();
        }

        $branchIds = collect([$user->branch_id])
            ->merge($user->branches()->pluck('branches.id'))
            ->filter()
            ->unique()
            ->values();

        return Branch::query()
            ->whereIn('id', $branchIds)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
    }
}
