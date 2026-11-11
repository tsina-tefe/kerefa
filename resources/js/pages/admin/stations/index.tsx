import InputError from '@/components/input-error';
import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Station {
    id: number;
    name: string;
    code: string;
    station_type: string;
    printer_model: string;
    printer_connection: string;
    printer_ip: string | null;
    printer_port: number;
    paper_width_mm: number;
    auto_print: boolean;
    print_copies: number;
    notes: string | null;
    is_active: boolean;
    menu_categories_count: number;
    created_at?: string | null;
}

interface Category {
    id: number;
    name: string;
    order_station_id: number | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

const emptyStation = {
    name: '',
    code: '',
    station_type: 'kitchen',
    printer_model: 'IRP 200D',
    printer_connection: 'thermal_80mm',
    printer_ip: '',
    printer_port: 9100,
    paper_width_mm: 80,
    auto_print: true,
    print_copies: 1,
    notes: '',
    category_ids: [] as number[],
};

export default function StationsIndex({
    stations,
    categories,
    canManage,
    filters,
}: {
    stations: Paginator<Station>;
    categories: Category[];
    canManage: boolean;
    filters: { search: string };
}) {
    const [editing, setEditing] = useState<Station | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const form = useForm(emptyStation);

    function load(station: Station | null) {
        setEditing(station);
        setFormOpen(true);
        form.setData(
            station
                ? {
                      name: station.name,
                      code: station.code,
                      station_type: station.station_type,
                      printer_model: station.printer_model,
                      printer_connection: station.printer_connection,
                      printer_ip: station.printer_ip ?? '',
                      printer_port: station.printer_port,
                      paper_width_mm: station.paper_width_mm,
                      auto_print: station.auto_print,
                      print_copies: station.print_copies,
                      notes: station.notes ?? '',
                      category_ids: categories.filter((category) => category.order_station_id === station.id).map((category) => category.id),
                  }
                : emptyStation,
        );
        form.clearErrors();
    }

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/stations', { search }, { preserveState: true, replace: true });
    }

    function deleteStation(id: number) {
        if (confirm('Are you sure you want to delete this station?')) {
            router.delete(`/stations/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Stations', href: '/stations' }]}>
            <Head title="Stations" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Stations Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stations..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {canManage && (
                                <Button
                                    variant="default"
                                    onClick={() => {
                                        load(null);
                                    }}
                                >
                                    Add New
                                </Button>
                            )}
                        </CardAction>
                    </CardHeader>
                    <hr />
                    {canManage && formOpen && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (editing) {
                                    form.put(`/stations/${editing.id}`, {
                                        onSuccess: () => {
                                            setEditing(null);
                                            setFormOpen(false);
                                            form.reset();
                                        },
                                    });
                                    return;
                                }
                                form.post('/stations', {
                                    onSuccess: () => {
                                        setFormOpen(false);
                                        form.reset();
                                    },
                                });
                            }}
                            className="grid gap-3 border-b p-6 sm:grid-cols-3"
                        >
                            <div className="font-medium sm:col-span-3">{editing ? `Edit ${editing.name}` : 'New station'}</div>
                            <Field label="Name" error={form.errors.name}>
                                <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                            </Field>
                            <Field label="Code" error={form.errors.code}>
                                <Input value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} required />
                            </Field>
                            <Field label="Type" error={form.errors.station_type}>
                                <select className="border-input h-10 rounded-md border px-3 text-sm" value={form.data.station_type} onChange={(event) => form.setData('station_type', event.target.value)}>
                                    {['kitchen', 'bar', 'grill', 'cafe', 'other'].map((type) => (
                                        <option key={type}>{type}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Printer model" error={form.errors.printer_model}>
                                <Input value={form.data.printer_model} onChange={(event) => form.setData('printer_model', event.target.value)} required />
                            </Field>
                            <Field label="Connection" error={form.errors.printer_connection}>
                                <select
                                    className="border-input h-10 rounded-md border px-3 text-sm"
                                    value={form.data.printer_connection}
                                    onChange={(event) => form.setData('printer_connection', event.target.value)}
                                >
                                    <option value="thermal_80mm">Thermal 80mm</option>
                                    <option value="network_ip">Network IP</option>
                                    <option value="usb_spooler">USB spooler</option>
                                </select>
                            </Field>
                            <Field label="Paper width" error={form.errors.paper_width_mm}>
                                <select
                                    className="border-input h-10 rounded-md border px-3 text-sm"
                                    value={form.data.paper_width_mm}
                                    onChange={(event) => form.setData('paper_width_mm', Number(event.target.value))}
                                >
                                    <option value={80}>80 mm</option>
                                    <option value={58}>58 mm</option>
                                </select>
                            </Field>
                            <Field label="Printer IP" error={form.errors.printer_ip}>
                                <Input value={form.data.printer_ip} onChange={(event) => form.setData('printer_ip', event.target.value)} />
                            </Field>
                            <Field label="Port" error={form.errors.printer_port}>
                                <Input type="number" value={form.data.printer_port} onChange={(event) => form.setData('printer_port', Number(event.target.value))} />
                            </Field>
                            <Field label="Copies" error={form.errors.print_copies}>
                                <Input type="number" min={1} max={5} value={form.data.print_copies} onChange={(event) => form.setData('print_copies', Number(event.target.value))} />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.data.auto_print} onChange={(event) => form.setData('auto_print', event.target.checked)} />
                                Auto print
                            </label>
                            {categories.length > 0 && (
                                <div className="flex flex-wrap gap-3 text-sm sm:col-span-3">
                                    {categories.map((category) => (
                                        <label key={category.id} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={form.data.category_ids.includes(category.id)}
                                                onChange={() =>
                                                    form.setData(
                                                        'category_ids',
                                                        form.data.category_ids.includes(category.id)
                                                            ? form.data.category_ids.filter((id) => id !== category.id)
                                                            : [...form.data.category_ids, category.id],
                                                    )
                                                }
                                            />
                                            {category.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button type="submit" disabled={form.processing}>
                                    {editing ? 'Save' : 'Add New'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditing(null);
                                        setFormOpen(false);
                                        form.reset();
                                        form.clearErrors();
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    )}
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">ID</TableHead>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Code</TableHead>
                                    <TableHead className="font-bold text-white">Type</TableHead>
                                    <TableHead className="font-bold text-white">Printer</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stations.data.map((station, index) => (
                                    <TableRow key={station.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(stations.from ?? 1) + index}</TableCell>
                                        <TableCell>{station.name}</TableCell>
                                        <TableCell>{station.code}</TableCell>
                                        <TableCell>{station.station_type}</TableCell>
                                        <TableCell>
                                            {station.printer_model} · {station.paper_width_mm}mm
                                        </TableCell>
                                        <TableCell>{station.is_active ? 'Active' : 'Inactive'}</TableCell>
                                        <TableCell>{station.created_at ? new Date(station.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {canManage && (
                                                <Button variant="outline" size="sm" onClick={() => load(station)}>
                                                    Edit
                                                </Button>
                                            )}
                                            {canManage && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteStation(station.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {stations.data.length > 0 ? (
                        <TablePagination total={stations.total} from={stations.from} to={stations.to} links={stations.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
