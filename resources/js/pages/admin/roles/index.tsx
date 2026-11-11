import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface RoleRow {
    id: number;
    name: string;
    label: string | null;
    description: string | null;
    is_system: boolean;
    permissions_count: number;
    users_count: number;
    created_at?: string | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export default function RolesIndex({ roles, filters }: { roles: Paginator<RoleRow>; filters: { search: string } }) {
    const { can } = usePermission();
    const [search, setSearch] = useState(filters.search ?? '');

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/roles', { search }, { preserveState: true, replace: true });
    }

    function deleteRole(id: number) {
        if (confirm('Are you sure you want to delete this role?')) {
            router.delete(`/roles/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Roles', href: '/roles' }]}>
            <Head title="Roles" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Roles Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {can('roles.manage') && (
                                <Link href="/roles/create">
                                    <Button variant="default">Add New</Button>
                                </Link>
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
                                    <TableHead className="font-bold text-white">Description</TableHead>
                                    <TableHead className="font-bold text-white">Users</TableHead>
                                    <TableHead className="font-bold text-white">Permissions</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.data.map((role, index) => (
                                    <TableRow key={role.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(roles.from ?? 1) + index}</TableCell>
                                        <TableCell>{role.label || role.name}</TableCell>
                                        <TableCell>{role.description || 'N/A'}</TableCell>
                                        <TableCell>{role.users_count}</TableCell>
                                        <TableCell>{role.permissions_count}</TableCell>
                                        <TableCell>{role.created_at ? new Date(role.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {can('roles.manage') && (
                                                <Link href={`/roles/${role.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        Edit
                                                    </Button>
                                                </Link>
                                            )}
                                            {can('roles.manage') && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteRole(role.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {roles.data.length > 0 ? (
                        <TablePagination total={roles.total} from={roles.from} to={roles.to} links={roles.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
