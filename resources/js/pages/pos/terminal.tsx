import { SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import PosApp from './PosApp';

interface TerminalProps {
    branch: { id: number; name: string; code?: string } | null;
    categories: unknown[];
    diningAreas: unknown[];
    recentOrders: unknown[];
    waiters: unknown[];
    csrfToken: string;
    serviceChargeRate: number;
    vatRate: number;
    routes: Record<string, string>;
}

export default function PosTerminal({ branch, categories, diningAreas, recentOrders, waiters, csrfToken, serviceChargeRate, vatRate, routes }: TerminalProps) {
    const { auth, name } = usePage<SharedData>().props;
    const role = auth.roles?.[0] ?? 'Staff';

    return (
        <>
            <Head title="POS Order Terminal">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <PosApp
                initialData={{
                    branch: branch ?? { id: 0, name: 'Branch' },
                    user: auth.user,
                    role,
                    categories,
                    diningAreas,
                    recentOrders,
                    waiters,
                    routes,
                    csrfToken,
                    serviceChargeRate,
                    vatRate,
                    appName: name || 'QEREFA',
                    permissions: auth.roles?.includes('super-admin') ? ['*'] : auth.permissions,
                }}
            />
        </>
    );
}
