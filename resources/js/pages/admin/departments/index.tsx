import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface DepartmentRow {
    id: number;
    code: string;
    name: string;
    type: string;
    is_active: boolean;
    users_count: number;
    created_at?: string | null;
    branch: { id: number; name: string; code: string } | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export default function DepartmentsIndex({ departments, filters }: { departments: Paginator<DepartmentRow>; filters: { search: string } }) {
    const { can } = usePermission();
    const [search, setSearch] = useState(filters.search ?? '');

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/departments', { search }, { preserveState: true, replace: true });
    }

    function deleteDepartment(id: number) {
        if (confirm('Are you sure you want to delete this department?')) {
            router.delete(`/departments/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Departments', href: '/departments' }]}>
            <Head title="Departments" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Departments Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {can('departments.manage') && (
                                <Link href="/departments/create">
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
                                    <TableHead className="font-bold text-white">Branch</TableHead>
                                    <TableHead className="font-bold text-white">Code</TableHead>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Type</TableHead>
                                    <TableHead className="font-bold text-white">Active</TableHead>
                                    <TableHead className="font-bold text-white">Users</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departments.data.map((department, index) => (
                                    <TableRow key={department.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(departments.from ?? 1) + index}</TableCell>
                                        <TableCell>{department.branch ? `${department.branch.name} (${department.branch.code})` : 'N/A'}</TableCell>
                                        <TableCell>{department.code}</TableCell>
                                        <TableCell>{department.name}</TableCell>
                                        <TableCell className="capitalize">{department.type}</TableCell>
                                        <TableCell>{department.is_active ? 'Yes' : 'No'}</TableCell>
                                        <TableCell>{department.users_count}</TableCell>
                                        <TableCell>{department.created_at ? new Date(department.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {can('departments.manage') && (
                                                <Link href={`/departments/${department.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        Edit
                                                    </Button>
                                                </Link>
                                            )}
                                            {can('departments.manage') && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteDepartment(department.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {departments.data.length > 0 ? (
                        <TablePagination total={departments.total} from={departments.from} to={departments.to} links={departments.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
