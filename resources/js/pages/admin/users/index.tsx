import TablePagination from '@/components/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface UserRow {
    id: number;
    name: string;
    username: string;
    email: string;
    is_active: boolean;
    created_at?: string | null;
    branch?: { name: string; code: string } | null;
    roles: { name: string; label: string | null }[];
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export default function UsersIndex({ users, filters }: { users: Paginator<UserRow>; filters: { search: string } }) {
    const { can } = usePermission();
    const [search, setSearch] = useState(filters.search ?? '');

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/users', { search }, { preserveState: true, replace: true });
    }

    function deleteUser(id: number) {
        if (confirm('Are you sure you want to delete this user?')) {
            router.delete(`/users/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Users', href: '/users' }]}>
            <Head title="Users" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Users Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {can('users.create') && (
                                <Link href="/users/create">
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
                                    <TableHead className="font-bold text-white">Username</TableHead>
                                    <TableHead className="font-bold text-white">Email</TableHead>
                                    <TableHead className="font-bold text-white">Branch</TableHead>
                                    <TableHead className="font-bold text-white">Roles</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.data.map((user, index) => (
                                    <TableRow key={user.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(users.from ?? 1) + index}</TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.username}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.branch?.name || 'N/A'}</TableCell>
                                        <TableCell className="flex flex-wrap items-center gap-2">
                                            {user.roles.length > 0 ? (
                                                user.roles.map((role) => (
                                                    <Badge variant="outline" key={role.name}>
                                                        {role.label || role.name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span>N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{user.is_active ? 'Active' : 'Inactive'}</TableCell>
                                        <TableCell>{user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {can('users.edit') && (
                                                <Link href={`/users/${user.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        Edit
                                                    </Button>
                                                </Link>
                                            )}
                                            {can('users.delete') && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteUser(user.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {users.data.length > 0 ? (
                        <TablePagination total={users.total} from={users.from} to={users.to} links={users.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
