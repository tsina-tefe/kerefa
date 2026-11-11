import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

export default function ComingSoon({ title }: { title: string }) {
    return (
        <AppLayout breadcrumbs={[{ title, href: '#' }]}>
            <Head title={title} />
            <div className="p-4">
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="text-muted-foreground mt-2 max-w-xl text-sm">
                    This screen comes after system administration. POS is next, then supply chain.
                </p>
            </div>
        </AppLayout>
    );
}
