import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

export default function Dashboard({
    stats,
}: {
    stats: { users: number; branches: number; stations: number; menu_items: number };
}) {
    const cards = [
        { label: 'Users', value: stats.users },
        { label: 'Branches', value: stats.branches },
        { label: 'Stations', value: stats.stations },
        { label: 'Menu items', value: stats.menu_items },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-muted-foreground text-sm">Administration is ready. POS and supply chain come next.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-xl border p-4">
                            <div className="text-muted-foreground text-sm">{card.label}</div>
                            <div className="mt-2 text-3xl font-semibold">{card.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
