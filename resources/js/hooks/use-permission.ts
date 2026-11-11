import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

export function usePermission() {
    const { auth } = usePage<SharedData>().props;
    const roles = auth.roles ?? [];
    const permissions = auth.permissions ?? [];
    const isSuperAdmin = roles.includes('super-admin');

    function can(permission?: string): boolean {
        if (!permission || isSuperAdmin) {
            return true;
        }

        return permissions.includes(permission);
    }

    return { can, isSuperAdmin };
}
