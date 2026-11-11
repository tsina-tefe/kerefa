import InputError from '@/components/input-error';
import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface PermissionRow {
    id: number;
    name: string;
    module: string | null;
    description: string | null;
    roles_count: number;
    created_at?: string | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

const emptyPermission = { id: 0, name: '', module: '', description: '' };

export default function PermissionsIndex({ permissions, filters }: { permissions: Paginator<PermissionRow>; filters: { search: string } }) {
    const { can } = usePermission();
    const [search, setSearch] = useState(filters.search ?? '');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(false);
    const form = useForm(emptyPermission);

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/permissions', { search }, { preserveState: true, replace: true });
    }

    function openAdd() {
        form.setData(emptyPermission);
        form.clearErrors();
        setAdding(true);
    }

    function openEdit(permission: PermissionRow) {
        form.setData({
            id: permission.id,
            name: permission.name,
            module: permission.module ?? '',
            description: permission.description ?? '',
        });
        form.clearErrors();
        setEditing(true);
    }

    function create(event: FormEvent) {
        event.preventDefault();
        form.post('/permissions', {
            onSuccess: () => {
                form.reset();
                setAdding(false);
            },
        });
    }

    function update(event: FormEvent) {
        event.preventDefault();
        form.put(`/permissions/${form.data.id}`, {
            onSuccess: () => setEditing(false),
        });
    }

    function deletePermission(id: number) {
        if (confirm('Are you sure you want to delete this permission?')) {
            router.delete(`/permissions/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Permissions', href: '/permissions' }]}>
            <Head title="Permissions" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Permissions Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permissions..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {can('permissions.manage') && (
                                <Button variant="default" onClick={openAdd}>
                                    Add New
                                </Button>
                            )}
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">ID</TableHead>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Module</TableHead>
                                    <TableHead className="font-bold text-white">Description</TableHead>
                                    <TableHead className="font-bold text-white">Roles</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {permissions.data.map((permission, index) => (
                                    <TableRow key={permission.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(permissions.from ?? 1) + index}</TableCell>
                                        <TableCell>{permission.name}</TableCell>
                                        <TableCell>{permission.module || 'N/A'}</TableCell>
                                        <TableCell>{permission.description || 'N/A'}</TableCell>
                                        <TableCell>{permission.roles_count}</TableCell>
                                        <TableCell>{permission.created_at ? new Date(permission.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {can('permissions.manage') && (
                                                <Button variant="outline" size="sm" onClick={() => openEdit(permission)}>
                                                    Edit
                                                </Button>
                                            )}
                                            {can('permissions.manage') && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deletePermission(permission.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {permissions.data.length > 0 ? (
                        <TablePagination total={permissions.total} from={permissions.from} to={permissions.to} links={permissions.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>

                <Dialog open={adding} onOpenChange={setAdding}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Permission</DialogTitle>
                        </DialogHeader>
                        <hr />
                        <form onSubmit={create}>
                            <PermissionFields form={form} />
                            <DialogFooter className="mt-4">
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={form.processing}>
                                    {form.processing && <Loader2 className="animate-spin" />}
                                    <span>Create</span>
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={editing} onOpenChange={setEditing}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Permission</DialogTitle>
                        </DialogHeader>
                        <hr />
                        <form onSubmit={update}>
                            <PermissionFields form={form} />
                            <DialogFooter className="mt-4">
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={form.processing}>
                                    {form.processing && <Loader2 className="animate-spin" />}
                                    <span>Update</span>
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}

function PermissionFields({
    form,
}: {
    form: {
        data: typeof emptyPermission;
        errors: Partial<Record<keyof typeof emptyPermission, string>>;
        setData: (key: keyof typeof emptyPermission, value: string | number) => void;
    };
}) {
    return (
        <div className="grid gap-4">
            <div className="grid gap-3">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="reports.view" aria-invalid={!!form.errors.name} />
                <InputError message={form.errors.name} />
            </div>
            <div className="grid gap-3">
                <Label htmlFor="module">Module</Label>
                <Input id="module" value={form.data.module} onChange={(event) => form.setData('module', event.target.value)} placeholder="reports" aria-invalid={!!form.errors.module} />
                <InputError message={form.errors.module} />
            </div>
            <div className="grid gap-3">
                <Label htmlFor="description">Description</Label>
                <Input
                    id="description"
                    value={form.data.description}
                    onChange={(event) => form.setData('description', event.target.value)}
                    placeholder="What this permission allows"
                    aria-invalid={!!form.errors.description}
                />
                <InputError message={form.errors.description} />
            </div>
        </div>
    );
}
