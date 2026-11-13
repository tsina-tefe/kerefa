import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Ban, Banknote, CalendarRange, ClipboardList, CookingPot, Package, Receipt, type LucideIcon } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

interface TrendPoint {
    label: string;
    amount: number;
}

interface Insights {
    branch: string | null;
    daily_sales: number;
    weekly_sales: number;
    yesterday_sales: number;
    change_percent: number | null;
    average_ticket: number;
    paid_orders: number;
    open_orders: number;
    cancelled_orders: number;
    low_stock: number;
    pending_orders: number;
    trend: TrendPoint[];
}

const money = (value: number) =>
    `ETB ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard({ insights }: { insights: Insights }) {
    const peak = Math.max(...insights.trend.map((point) => point.amount), 1);
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-semibold">Dashboard</h1>
                        <p className="text-muted-foreground text-sm">{insights.branch ? `${insights.branch} · ${today}` : today}</p>
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                    <SalesCard
                        label="Today's sales"
                        value={money(insights.daily_sales)}
                        detail={
                            insights.change_percent === null
                                ? `${insights.paid_orders} paid orders`
                                : `${insights.change_percent > 0 ? '+' : ''}${insights.change_percent}% vs yesterday`
                        }
                        icon={Banknote}
                        tone="emerald"
                    />
                    <SalesCard
                        label="This week's sales"
                        value={money(insights.weekly_sales)}
                        detail="Monday through today"
                        icon={CalendarRange}
                        tone="sky"
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Average ticket" value={money(insights.average_ticket)} hint="Paid orders today" icon={Receipt} tone="violet" />
                    <MetricCard label="Open orders" value={String(insights.open_orders)} hint="Still in preparation" icon={CookingPot} tone="amber" />
                    <MetricCard label="Cancelled orders" value={String(insights.cancelled_orders)} hint="Cancelled today" icon={Ban} tone="red" />
                    <MetricCard
                        label="Needs attention"
                        value={String(insights.low_stock + insights.pending_orders)}
                        hint={`${insights.low_stock} low stock · ${insights.pending_orders} purchase orders`}
                        icon={insights.low_stock > 0 ? Package : ClipboardList}
                        tone="rose"
                    />
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <div className="font-semibold">Last 7 days</div>
                            <div className="text-muted-foreground text-xs">Paid sales by day</div>
                        </div>
                        <div className="text-sm font-medium">{money(insights.trend.reduce((sum, point) => sum + point.amount, 0))}</div>
                    </div>
                    <div className="flex h-36 items-end gap-2">
                        {insights.trend.map((point) => (
                            <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                                <div className="text-[10px] text-slate-500">{point.amount > 0 ? Math.round(point.amount) : ''}</div>
                                <div
                                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400"
                                    style={{ height: `${Math.max(point.amount > 0 ? 8 : 2, (point.amount / peak) * 100)}%` }}
                                />
                                <div className="text-xs text-slate-500">{point.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function SalesCard({
    label,
    value,
    detail,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    tone: 'emerald' | 'sky';
}) {
    const tones = {
        emerald: 'from-emerald-500 to-teal-600',
        sky: 'from-sky-500 to-blue-600',
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-sm`}>
            <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-white/15" />
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white/80">{label}</div>
                <Icon className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
            <div className="mt-1 text-sm text-white/80">{detail}</div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    hint,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    tone: 'violet' | 'amber' | 'red' | 'rose';
}) {
    const tones = {
        violet: 'bg-violet-50 text-violet-700',
        amber: 'bg-amber-50 text-amber-700',
        red: 'bg-red-50 text-red-700',
        rose: 'bg-rose-50 text-rose-700',
    };

    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">{label}</div>
                <div className={`rounded-lg p-2 ${tones[tone]}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{hint}</div>
        </div>
    );
}
