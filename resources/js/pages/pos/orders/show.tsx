import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface OrderItemRow {
    id: number;
    name: string;
    quantity: string;
    unit_price: string;
    subtotal: string;
    preparation_department: string;
    special_instructions: string | null;
    status: string;
    modifiers: { id: number; name: string; unit_price: string }[];
}

interface OrderDetails {
    id: number;
    order_number: string;
    order_type: string;
    status: string;
    payment_status: string;
    customer_name: string | null;
    customer_phone: string | null;
    delivery_address: string | null;
    notes: string | null;
    subtotal: string;
    service_charge_amount: string;
    tax_amount: string;
    total_amount: string;
    amount_paid: string;
    cancellation_reason: string | null;
    created_at: string;
    table?: { table_number: string; dining_area?: { name: string } | null } | null;
    waiter?: { name: string } | null;
    cashier?: { name: string } | null;
    items: OrderItemRow[];
    tickets: {
        id: number;
        ticket_number: string;
        department: string;
        status: string;
        order_station?: { name: string } | null;
        items?: { order_item?: { menu_item?: { category?: { name: string } | null } | null } | null }[];
    }[];
    payments: { id: number; method: string; amount: string; paid_at: string }[];
}

function money(value: string | number) {
    return Number(value).toFixed(2);
}

export default function OrderShow({
    order,
    statuses,
    types,
    methods,
}: {
    order: OrderDetails;
    statuses: Record<string, string>;
    types: Record<string, string>;
    methods: Record<string, string>;
}) {
    const { can } = usePermission();
    const open = order.status !== 'completed' && order.status !== 'cancelled';
    const balance = Math.max(0, Number(order.total_amount) - Number(order.amount_paid));
    const settleForm = useForm({ method: 'cash', amount_tendered: balance.toFixed(2) });
    const [confirmCancel, setConfirmCancel] = useState(false);
    const cancelForm = useForm({ reason: '' });

    function settle(event: FormEvent) {
        event.preventDefault();
        settleForm.post(`/orders/${order.id}/settle`);
    }

    function cancel(event: FormEvent) {
        event.preventDefault();
        setConfirmCancel(true);
    }

    function confirmCancelOrder() {
        setConfirmCancel(false);
        cancelForm.post(`/orders/${order.id}/cancel`);
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Orders', href: '/orders' }, { title: order.order_number, href: `/orders/${order.id}` }]}>
            <Head title={order.order_number} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>{order.order_number}</CardTitle>
                        <CardAction>
                            <Link href="/orders">
                                <Button>Go Back</Button>
                            </Link>
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>Type: {types[order.order_type] ?? order.order_type}</div>
                        <div>Status: {statuses[order.status] ?? order.status}</div>
                        <div className="capitalize">Payment: {order.payment_status.replace('_', ' ')}</div>
                        <div>Table: {order.table ? `${order.table.table_number}${order.table.dining_area ? ` · ${order.table.dining_area.name}` : ''}` : 'N/A'}</div>
                        <div>Waiter: {order.waiter?.name || 'N/A'}</div>
                        <div>Cashier: {order.cashier?.name || 'N/A'}</div>
                        <div>Customer: {order.customer_name || 'N/A'}</div>
                        <div>Phone: {order.customer_phone || 'N/A'}</div>
                        {order.delivery_address && <div className="sm:col-span-2">Address: {order.delivery_address}</div>}
                        {order.notes && <div className="sm:col-span-2">Notes: {order.notes}</div>}
                        {order.cancellation_reason && <div className="sm:col-span-2">Cancellation: {order.cancellation_reason}</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Item</TableHead>
                                    <TableHead className="font-bold text-white">Qty</TableHead>
                                    <TableHead className="font-bold text-white">Price</TableHead>
                                    <TableHead className="font-bold text-white">Station</TableHead>
                                    <TableHead className="font-bold text-white">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...order.items]
                                    .sort((left, right) => Number(left.status === 'cancelled' || left.status === 'voided') - Number(right.status === 'cancelled' || right.status === 'voided') || left.id - right.id)
                                    .map((item) => {
                                        const inactive = item.status === 'cancelled' || item.status === 'voided';

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className={
                                                    inactive
                                                        ? 'bg-red-50 text-red-800 line-through odd:bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:text-red-200 dark:odd:bg-red-950 dark:hover:bg-red-900'
                                                        : 'odd:bg-slate-100 dark:odd:bg-slate-800'
                                                }
                                            >
                                                <TableCell>
                                                    <div>
                                                        {item.name}
                                                        {inactive && (
                                                            <span className="ml-2 text-xs font-semibold uppercase no-underline">
                                                                {item.status === 'voided' ? 'Voided' : 'Cancelled'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.modifiers.length > 0 && <div className="text-muted-foreground text-xs">{item.modifiers.map((modifier) => modifier.name).join(', ')}</div>}
                                                    {item.special_instructions && <div className="text-xs">{item.special_instructions}</div>}
                                                </TableCell>
                                                <TableCell>{Number(item.quantity)}</TableCell>
                                                <TableCell>{money(item.unit_price)}</TableCell>
                                                <TableCell className="capitalize">{item.preparation_department}</TableCell>
                                                <TableCell>{money(item.subtotal)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                            </TableBody>
                        </Table>
                        <div className="ml-auto mt-4 grid w-full max-w-xs gap-1 text-sm">
                            <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                            <div className="flex justify-between"><span>Service charge</span><span>{money(order.service_charge_amount)}</span></div>
                            <div className="flex justify-between"><span>VAT</span><span>{money(order.tax_amount)}</span></div>
                            <div className="flex justify-between font-semibold"><span>Total</span><span>{money(order.total_amount)}</span></div>
                            <div className="flex justify-between"><span>Paid</span><span>{money(order.amount_paid)}</span></div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tickets</CardTitle>
                    </CardHeader>
                    <hr />
                    <CardContent className="grid gap-2 text-sm">
                        {order.tickets.map((ticket) => (
                            <div key={ticket.id}>
                                {ticket.ticket_number} · {ticket.items?.[0]?.order_item?.menu_item?.category?.name || ticket.department} · {ticket.order_station?.name || 'No station'} · {ticket.status}
                            </div>
                        ))}
                        {order.tickets.length === 0 && <div>No tickets.</div>}
                    </CardContent>
                </Card>

                {open && can('pos.orders.settle') && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Settle</CardTitle>
                        </CardHeader>
                        <hr />
                        <CardContent>
                            <form onSubmit={settle} className="grid max-w-md gap-3">
                                <div>
                                    <Label htmlFor="method">Method</Label>
                                    <select id="method" className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm" value={settleForm.data.method} onChange={(event) => settleForm.setData('method', event.target.value)}>
                                        {Object.entries(methods).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={settleForm.errors.method} />
                                </div>
                                <div>
                                    <Label htmlFor="amount">Amount tendered</Label>
                                    <Input id="amount" type="number" min="0" step="0.01" value={settleForm.data.amount_tendered} onChange={(event) => settleForm.setData('amount_tendered', event.target.value)} />
                                    <InputError message={settleForm.errors.amount_tendered} />
                                </div>
                                <div>
                                    <Button type="submit" disabled={settleForm.processing}>
                                        Settle
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {open && can('pos.orders.cancel') && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Cancel order</CardTitle>
                        </CardHeader>
                        <hr />
                        <CardContent>
                            <form onSubmit={cancel} className="grid max-w-md gap-3">
                                <div>
                                    <Label htmlFor="reason">Reason</Label>
                                    <Input id="reason" value={cancelForm.data.reason} onChange={(event) => cancelForm.setData('reason', event.target.value)} />
                                    <InputError message={cancelForm.errors.reason} />
                                </div>
                                <div>
                                    <Button type="submit" variant="destructive" disabled={cancelForm.processing}>
                                        Cancel order
                                    </Button>
                                </div>
                            </form>
                            <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Cancel this order?</DialogTitle>
                                        <DialogDescription>
                                            {`Order ${order.order_number} will be cancelled${cancelForm.data.reason ? ` because "${cancelForm.data.reason}"` : ''}. This cannot be undone.`}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setConfirmCancel(false)}>
                                            Keep order
                                        </Button>
                                        <Button type="button" variant="destructive" disabled={cancelForm.processing} onClick={confirmCancelOrder}>
                                            Cancel order
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
