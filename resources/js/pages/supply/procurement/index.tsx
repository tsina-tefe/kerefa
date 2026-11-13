import InputError from '@/components/input-error';
import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';

interface SupplierRow {
    id: number;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
}

interface StockOption {
    id: number;
    name: string;
    unit: string;
    unit_cost: string;
}

interface OrderLine {
    id: number;
    name: string;
    quantity_ordered: string;
    quantity_received: string;
    unit: string;
    unit_cost: string;
    subtotal: string;
}

interface OrderRow {
    id: number;
    po_number: string;
    status: string;
    total_amount: string;
    notes: string | null;
    created_at: string;
    supplier: { id: number; name: string } | null;
    creator: { id: number; name: string } | null;
    items: OrderLine[];
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface DraftLine {
    inventory_item_id: string;
    quantity: string;
    unit_cost: string;
}

const money = (value: number | string) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyLine = (): DraftLine => ({ inventory_item_id: '', quantity: '1', unit_cost: '' });

export default function ProcurementIndex({
    orders,
    suppliers,
    items,
    stats,
    can,
}: {
    orders: Paginator<OrderRow>;
    suppliers: SupplierRow[];
    items: StockOption[];
    stats: { total_orders: number; suppliers_count: number; spend: number };
    can: { orders: boolean; receiving: boolean };
}) {
    const [addingSupplier, setAddingSupplier] = useState(false);
    const [addingOrder, setAddingOrder] = useState(false);
    const [receiving, setReceiving] = useState<OrderRow | null>(null);
    const receiveTarget = useRef<OrderRow | null>(null);
    if (receiving) receiveTarget.current = receiving;
    const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
    const supplierForm = useForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
    const orderForm = useForm({ supplier_id: '', notes: '', items: [emptyLine()] });

    function createSupplier(event: FormEvent) {
        event.preventDefault();
        supplierForm.post('/procurement/suppliers', {
            onSuccess: () => {
                supplierForm.reset();
                setAddingSupplier(false);
            },
        });
    }

    function updateLine(index: number, patch: Partial<DraftLine>) {
        const next = lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line));
        setLines(next);
        orderForm.setData('items', next);
    }

    function createOrder(event: FormEvent) {
        event.preventDefault();
        orderForm.transform((data) => ({ ...data, items: lines }));
        orderForm.post('/procurement/orders', {
            onSuccess: () => {
                orderForm.reset();
                setLines([emptyLine()]);
                setAddingOrder(false);
            },
        });
    }

    function confirmReceive() {
        if (!receiving) return;
        router.post(`/procurement/orders/${receiving.id}/receive`, {}, {
            onFinish: () => setReceiving(null),
        });
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Procurement', href: '/procurement' }]}>
            <Head title="Procurement" />
            <div className="flex h-full flex-1 flex-col gap-2 overflow-x-auto rounded-xl p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase orders</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold">{stats.total_orders}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Suppliers</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold">{stats.suppliers_count}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Received spend</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold">ETB {money(stats.spend)}</CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
                        <CardTitle className="text-base">Suppliers</CardTitle>
                        {can.orders && (
                            <CardAction>
                                <Button onClick={() => setAddingSupplier(true)}>Add supplier</Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent className="px-3 pb-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {suppliers.map((supplier) => (
                                <div key={supplier.id} className="rounded-lg border px-3 py-2">
                                    <div className="font-semibold">{supplier.name}</div>
                                    <div className="text-muted-foreground text-sm">{supplier.contact_person || 'No contact'}</div>
                                    <div className="text-muted-foreground text-sm">{supplier.phone || supplier.email || '—'}</div>
                                </div>
                            ))}
                        </div>
                        {suppliers.length === 0 && <div className="p-6 text-center text-muted-foreground">No suppliers yet.</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
                        <CardTitle className="text-base">Purchase orders</CardTitle>
                        {can.orders && (
                            <CardAction>
                                <Button
                                    onClick={() => {
                                        setLines([emptyLine()]);
                                        orderForm.reset();
                                        setAddingOrder(true);
                                    }}
                                    disabled={suppliers.length === 0 || items.length === 0}
                                >
                                    Create order
                                </Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent className="px-3 pb-3">
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">PO</TableHead>
                                    <TableHead className="font-bold text-white">Supplier</TableHead>
                                    <TableHead className="font-bold text-white">Items</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Total</TableHead>
                                    {can.receiving && <TableHead className="font-bold text-white">Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.data.map((order) => (
                                    <TableRow key={order.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell className="font-mono">{order.po_number}</TableCell>
                                        <TableCell>{order.supplier?.name}</TableCell>
                                        <TableCell>{order.items.map((line) => `${line.name} (${Number(line.quantity_ordered)} ${line.unit})`).join(', ')}</TableCell>
                                        <TableCell>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                                                {order.status === 'received' ? 'Received' : 'Pending'}
                                            </span>
                                        </TableCell>
                                        <TableCell>ETB {money(order.total_amount)}</TableCell>
                                        {can.receiving && (
                                            <TableCell>
                                                {order.status === 'pending' && (
                                                    <Button variant="outline" size="sm" onClick={() => setReceiving(order)}>
                                                        Receive
                                                    </Button>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {orders.data.length === 0 && <div className="p-6 text-center text-muted-foreground">No purchase orders yet.</div>}
                        <TablePagination links={orders.links} total={orders.total} from={orders.from} to={orders.to} />
                    </CardContent>
                </Card>
            </div>

            <Dialog open={addingSupplier} onOpenChange={setAddingSupplier}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add supplier</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={createSupplier} className="space-y-3">
                        <div>
                            <Label htmlFor="supplier-name">Name</Label>
                            <Input id="supplier-name" value={supplierForm.data.name} onChange={(event) => supplierForm.setData('name', event.target.value)} />
                            <InputError message={supplierForm.errors.name} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="supplier-contact">Contact</Label>
                                <Input id="supplier-contact" value={supplierForm.data.contact_person} onChange={(event) => supplierForm.setData('contact_person', event.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor="supplier-phone">Phone</Label>
                                <Input id="supplier-phone" value={supplierForm.data.phone} onChange={(event) => supplierForm.setData('phone', event.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={supplierForm.processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={receiving !== null} onOpenChange={(open) => !open && setReceiving(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Receive into stock</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground text-sm">
                        Receive {receiveTarget.current?.po_number} into stock? The ordered quantities will be added to this branch.
                    </p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setReceiving(null)}>
                            Keep pending
                        </Button>
                        <Button type="button" onClick={confirmReceive}>
                            Receive
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addingOrder} onOpenChange={setAddingOrder}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create purchase order</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={createOrder} className="space-y-3">
                        <div>
                            <Label htmlFor="po-supplier">Supplier</Label>
                            <select
                                id="po-supplier"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={orderForm.data.supplier_id}
                                onChange={(event) => orderForm.setData('supplier_id', event.target.value)}
                            >
                                <option value="">Select</option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={orderForm.errors.supplier_id} />
                        </div>
                        {lines.map((line, index) => (
                            <div key={index} className="grid grid-cols-3 gap-2">
                                <div>
                                    <Label htmlFor={`po-item-${index}`}>Item</Label>
                                    <select
                                        id={`po-item-${index}`}
                                        className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        value={line.inventory_item_id}
                                        onChange={(event) => {
                                            const item = items.find((option) => String(option.id) === event.target.value);
                                            updateLine(index, { inventory_item_id: event.target.value, unit_cost: item ? String(Number(item.unit_cost)) : line.unit_cost });
                                        }}
                                    >
                                        <option value="">Select item</option>
                                        {items.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor={`po-qty-${index}`}>Quantity</Label>
                                    <Input id={`po-qty-${index}`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                                </div>
                                <div>
                                    <Label htmlFor={`po-cost-${index}`}>Unit cost</Label>
                                    <Input id={`po-cost-${index}`} type="number" min="0" step="0.01" value={line.unit_cost} onChange={(event) => updateLine(index, { unit_cost: event.target.value })} />
                                </div>
                            </div>
                        ))}
                        <InputError message={orderForm.errors.items} />
                        <Button type="button" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                            Add line
                        </Button>
                        <div>
                            <Label htmlFor="po-notes">Notes</Label>
                            <Input id="po-notes" value={orderForm.data.notes} onChange={(event) => orderForm.setData('notes', event.target.value)} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={orderForm.processing}>
                                Issue order
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
