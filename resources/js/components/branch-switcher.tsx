import { usePermission } from '@/hooks/use-permission';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';

export function BranchSwitcher() {
    const { currentBranch, accessibleBranches } = usePage<SharedData>().props;
    const { can } = usePermission();

    if (!currentBranch) {
        return <span className="text-muted-foreground text-sm">No branch</span>;
    }

    if (!can('branches.switch') || accessibleBranches.length < 2) {
        return (
            <span className="rounded-full border px-3 py-1 text-sm font-medium">
                {currentBranch.name}
                <span className="text-muted-foreground ml-2 text-xs">{currentBranch.code}</span>
            </span>
        );
    }

    return (
        <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground hidden sm:inline">Branch</span>
            <select
                className="border-input bg-background h-9 rounded-md border px-3"
                value={currentBranch.id}
                onChange={(event) => router.post(route('branches.switch'), { branch_id: event.target.value }, { preserveScroll: true })}
            >
                {accessibleBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                    </option>
                ))}
            </select>
        </label>
    );
}
