import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

export function FlashBanner() {
    const { flash } = usePage<SharedData>().props;

    if (!flash?.success && !flash?.error) {
        return null;
    }

    return (
        <div className={`mx-4 mt-4 rounded-md border px-4 py-3 text-sm ${flash.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {flash.error || flash.success}
        </div>
    );
}
