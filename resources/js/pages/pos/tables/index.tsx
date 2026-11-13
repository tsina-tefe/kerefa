import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface DiningTable {
    id: number;
    dining_area_id: number;
    table_number: string;
    capacity: number;
    status: string;
    is_active: boolean;
    active_order?: { id: number; order_number: string; total_amount: string } | null;
}

interface DiningAreaRow {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    tables: DiningTable[];
}

const statusTone: Record<string, string> = {
    available: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    occupied: 'border-orange-500 bg-orange-50 text-orange-950',
    reserved: 'border-sky-500 bg-sky-50 text-sky-950',
    maintenance: 'border-slate-400 bg-slate-100 text-slate-700',
};

export default function TablesIndex({ areas, statuses }: { areas: DiningAreaRow[]; statuses: Record<string, string> }) {
    const { can } = usePermission();
    const canManage = can('pos.tables.manage');
    const canMove = can('pos.orders.edit');
    const tables = areas.flatMap((area) => area.tables);
    const [areaOpen, setAreaOpen] = useState(false);
    const [tableOpen, setTableOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState<'transfer' | 'merge' | null>(null);
    const [moving, setMoving] = useState<DiningTable | null>(null);
    const areaForm = useForm({ id: 0, name: '', description: '', is_active: true });
    const tableForm = useForm({ id: 0, dining_area_id: '', table_number: '', capacity: '4', status: 'available', is_active: true });
    const moveForm = useForm({ target_table_id: '' });

    function openArea(area?: DiningAreaRow) {
        areaForm.setData({
            id: area?.id ?? 0,
            name: area?.name ?? '',
            description: area?.description ?? '',
            is_active: area?.is_active ?? true,
        });
        areaForm.clearErrors();
        setAreaOpen(true);
    }

    function saveArea(event: FormEvent) {
        event.preventDefault();
        const options = { onSuccess: () => setAreaOpen(false) };
        if (areaForm.data.id) {
            areaForm.put(`/dining-areas/${areaForm.data.id}`, options);
            return;
        }
        areaForm.post('/dining-areas', options);
    }

    function openTable(table?: DiningTable) {
        tableForm.setData({
            id: table?.id ?? 0,
            dining_area_id: table ? String(table.dining_area_id) : areas[0] ? String(areas[0].id) : '',
            table_number: table?.table_number ?? '',
            capacity: table ? String(table.capacity) : '4',
            status: table?.status ?? 'available',
            is_active: table?.is_active ?? true,
        });
        tableForm.clearErrors();
        setTableOpen(true);
    }

    function saveTable(event: FormEvent) {
        event.preventDefault();
        const options = { onSuccess: () => setTableOpen(false) };
        if (tableForm.data.id) {
            tableForm.put(`/tables/${tableForm.data.id}`, options);
            return;
        }
        tableForm.post('/tables', options);
    }

    function openMove(kind: 'transfer' | 'merge', table: DiningTable) {
        setMoving(table);
        setMoveOpen(kind);
        moveForm.setData('target_table_id', '');
        moveForm.clearErrors();
    }

    function saveMove(event: FormEvent) {
        event.preventDefault();
        if (!moving || !moveOpen) {
            return;
        }
        moveForm.post(`/tables/${moving.id}/${moveOpen}`, { onSuccess: () => setMoveOpen(null) });
    }

    const targets = tables.filter((table) => table.id !== moving?.id && table.is_active && (moveOpen === 'merge' || table.status === 'available'));

    return (
        <AppLayout breadcrumbs={[{ title: 'Table Floor Plan', href: '/tables' }]}>
            <Head title="Table Floor Plan" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Dining Areas</CardTitle>
                        {canManage && (
                            <CardAction>
                                <Button onClick={() => openArea()}>Add New</Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Description</TableHead>
                                    <TableHead className="font-bold text-white">Tables</TableHead>
                                    <TableHead className="font-bold text-white">Active</TableHead>
                                    {canManage && <TableHead className="font-bold text-white">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {areas.map((area) => (
                                    <TableRow key={area.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{area.name}</TableCell>
                                        <TableCell>{area.description || 'N/A'}</TableCell>
                                        <TableCell>{area.tables.length}</TableCell>
                                        <TableCell>{area.is_active ? 'Yes' : 'No'}</TableCell>
                                        {canManage && (
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => openArea(area)}>
                                                    Edit
                                                </Button>
                                                <Button
                                                    className="m-2"
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => confirm('Are you sure you want to delete this dining area?') && router.delete(`/dining-areas/${area.id}`)}
                                                >
                                                    Delete
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {areas.length === 0 && <div className="flex items-center justify-center p-6">No Results Found!</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Floor Plan</CardTitle>
                        {canManage && (
                            <CardAction>
                                <Button onClick={() => openTable()} disabled={areas.length === 0}>
                                    Add New
                                </Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent className="grid gap-6">
                        {areas.map((area) => (
                            <section key={area.id}>
                                <h2 className="mb-3 font-medium">{area.name}</h2>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                    {area.tables.map((table) => (
                                        <div key={table.id} className={`rounded-lg border-2 p-3 ${statusTone[table.status] ?? statusTone.available}`}>
                                            <div className="text-lg font-semibold">{table.table_number}</div>
                                            <div className="text-sm">{table.capacity} seats</div>
                                            <div className="text-sm capitalize">{statuses[table.status] ?? table.status}</div>
                                            {table.active_order && <div className="mt-1 text-xs">{table.active_order.order_number}</div>}
                                        </div>
                                    ))}
                                    {area.tables.length === 0 && <p className="text-muted-foreground text-sm">No tables in this area.</p>}
                                </div>
                            </section>
                        ))}
                        {areas.length === 0 && <div className="flex items-center justify-center p-6">Add a dining area before placing tables.</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tables</CardTitle>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Number</TableHead>
                                    <TableHead className="font-bold text-white">Area</TableHead>
                                    <TableHead className="font-bold text-white">Seats</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Order</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {areas.flatMap((area) =>
                                    area.tables.map((table) => (
                                        <TableRow key={table.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                            <TableCell>{table.table_number}</TableCell>
                                            <TableCell>{area.name}</TableCell>
                                            <TableCell>{table.capacity}</TableCell>
                                            <TableCell>{statuses[table.status] ?? table.status}</TableCell>
                                            <TableCell>{table.active_order?.order_number || 'N/A'}</TableCell>
                                            <TableCell>
                                                {canManage && (
                                                    <Button variant="outline" size="sm" onClick={() => openTable(table)}>
                                                        Edit
                                                    </Button>
                                                )}
                                                {canMove && table.active_order && (
                                                    <Button className="m-2" variant="outline" size="sm" onClick={() => openMove('transfer', table)}>
                                                        Transfer
                                                    </Button>
                                                )}
                                                {canManage && (
                                                    <Button className="m-2" variant="outline" size="sm" onClick={() => openMove('merge', table)}>
                                                        Merge
                                                    </Button>
                                                )}
                                                {canManage && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => confirm('Are you sure you want to delete this table?') && router.delete(`/tables/${table.id}`)}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )),
                                )}
                            </TableBody>
                        </Table>
                        {tables.length === 0 && <div className="flex items-center justify-center p-6">No Results Found!</div>}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={areaOpen} onOpenChange={setAreaOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{areaForm.data.id ? 'Edit Dining Area' : 'Add Dining Area'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveArea} className="grid gap-3">
                        <div>
                            <Label htmlFor="area-name">Name</Label>
                            <Input id="area-name" value={areaForm.data.name} onChange={(event) => areaForm.setData('name', event.target.value)} />
                            <InputError message={areaForm.errors.name} />
                        </div>
                        <div>
                            <Label htmlFor="area-description">Description</Label>
                            <Input id="area-description" value={areaForm.data.description} onChange={(event) => areaForm.setData('description', event.target.value)} />
                            <InputError message={areaForm.errors.description} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={areaForm.data.is_active} onChange={(event) => areaForm.setData('is_active', event.target.checked)} />
                            Active
                        </label>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={areaForm.processing}>
                                {areaForm.data.id ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={tableOpen} onOpenChange={setTableOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{tableForm.data.id ? 'Edit Table' : 'Add Table'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveTable} className="grid gap-3">
                        <div>
                            <Label htmlFor="table-area">Dining area</Label>
                            <select
                                id="table-area"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={tableForm.data.dining_area_id}
                                onChange={(event) => tableForm.setData('dining_area_id', event.target.value)}
                            >
                                {areas.map((area) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={tableForm.errors.dining_area_id} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="table-number">Number</Label>
                                <Input id="table-number" value={tableForm.data.table_number} onChange={(event) => tableForm.setData('table_number', event.target.value)} />
                                <InputError message={tableForm.errors.table_number} />
                            </div>
                            <div>
                                <Label htmlFor="table-capacity">Seats</Label>
                                <Input id="table-capacity" type="number" min="1" max="50" value={tableForm.data.capacity} onChange={(event) => tableForm.setData('capacity', event.target.value)} />
                                <InputError message={tableForm.errors.capacity} />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="table-status">Status</Label>
                            <select
                                id="table-status"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={tableForm.data.status}
                                onChange={(event) => tableForm.setData('status', event.target.value)}
                                disabled={tableForm.data.status === 'occupied'}
                            >
                                {Object.entries(statuses)
                                    .filter(([value]) => value !== 'occupied' || tableForm.data.status === 'occupied')
                                    .map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                            </select>
                            <InputError message={tableForm.errors.status} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={tableForm.data.is_active} onChange={(event) => tableForm.setData('is_active', event.target.checked)} />
                            Active
                        </label>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={tableForm.processing || areas.length === 0}>
                                {tableForm.data.id ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={moveOpen !== null} onOpenChange={(open) => !open && setMoveOpen(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{moveOpen === 'merge' ? `Merge table ${moving?.table_number}` : `Transfer table ${moving?.table_number}`}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveMove} className="grid gap-3">
                        <div>
                            <Label htmlFor="target-table">Target table</Label>
                            <select
                                id="target-table"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={moveForm.data.target_table_id}
                                onChange={(event) => moveForm.setData('target_table_id', event.target.value)}
                            >
                                <option value="">Choose a table</option>
                                {targets.map((table) => (
                                    <option key={table.id} value={table.id}>
                                        {table.table_number}
                                    </option>
                                ))}
                            </select>
                            <InputError message={moveForm.errors.target_table_id} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={moveForm.processing || moveForm.data.target_table_id === ''}>
                                {moveOpen === 'merge' ? 'Merge' : 'Transfer'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
