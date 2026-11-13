import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface OrderRow {
    id: number;
    order_number: string;
    order_type: string;
    status: string;
    payment_status: string;
    total_amount: string;
    customer_name: string | null;
    created_at: string;
    table?: { table_number: string } | null;
    waiter?: { name: string } | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

function money(value: string | number) {
    return Number(value).toFixed(2);
}

const statusTone: Record<string, string> = {
    in_preparation: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
    completed: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    cancelled: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
};

export default function OrdersIndex({
    orders,
    filters,
    statuses,
    types,
}: {
    orders: Paginator<OrderRow>;
    filters: { search: string; status: string; order_type: string };
    statuses: Record<string, string>;
    types: Record<string, string>;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [orderType, setOrderType] = useState(filters.order_type ?? '');

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/orders', { search, status, order_type: orderType }, { preserveState: true, replace: true });
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Orders', href: '/orders' }]}>
            <Head title="Orders" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Orders</CardTitle>
                        <form className="ml-4 flex flex-wrap gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders..." />
                            <select className="border-input h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                                <option value="">All statuses</option>
                                {Object.entries(statuses).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <select className="border-input h-10 rounded-md border bg-background px-3 text-sm" value={orderType} onChange={(event) => setOrderType(event.target.value)}>
                                <option value="">All types</option>
                                {Object.entries(types).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Order</TableHead>
                                    <TableHead className="font-bold text-white">Type</TableHead>
                                    <TableHead className="font-bold text-white">Table</TableHead>
                                    <TableHead className="font-bold text-white">Waiter</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Payment</TableHead>
                                    <TableHead className="font-bold text-white">Total</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.data.map((order) => (
                                    <TableRow key={order.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{order.order_number}</TableCell>
                                        <TableCell>{types[order.order_type] ?? order.order_type}</TableCell>
                                        <TableCell>{order.table?.table_number || order.customer_name || 'N/A'}</TableCell>
                                        <TableCell>{order.waiter?.name || 'N/A'}</TableCell>
                                        <TableCell>
                                            <span
                                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusTone[order.status] ?? 'border-slate-300 bg-slate-50 text-slate-700'}`}
                                            >
                                                {statuses[order.status] ?? order.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="capitalize">{order.payment_status.replace('_', ' ')}</TableCell>
                                        <TableCell>{money(order.total_amount)}</TableCell>
                                        <TableCell>
                                            <Link href={`/orders/${order.id}`}>
                                                <Button variant="outline" size="sm">
                                                    View
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {orders.data.length > 0 ? (
                        <TablePagination total={orders.total} from={orders.from} to={orders.to} links={orders.links} />
                    ) : (
                        <div className="flex items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
