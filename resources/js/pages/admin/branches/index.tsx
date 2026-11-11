import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface BranchRow {
    id: number;
    code: string;
    name: string;
    currency: string;
    is_main: boolean;
    is_active: boolean;
    departments_count: number;
    created_at?: string | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export default function BranchesIndex({ branches, filters }: { branches: Paginator<BranchRow>; filters: { search: string } }) {
    const { can } = usePermission();
    const [search, setSearch] = useState(filters.search ?? '');

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/branches', { search }, { preserveState: true, replace: true });
    }

    function deleteBranch(id: number) {
        if (confirm('Are you sure you want to delete this branch?')) {
            router.delete(`/branches/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Branches', href: '/branches' }]}>
            <Head title="Branches" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Branches Management</CardTitle>
                        <form className="ml-4 flex gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search branches..." />
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            {can('branches.manage') && (
                                <Link href="/branches/create">
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
                                    <TableHead className="font-bold text-white">Branch Code</TableHead>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Currency</TableHead>
                                    <TableHead className="font-bold text-white">Departments</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    <TableHead className="font-bold text-white">Created At</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {branches.data.map((branch, index) => (
                                    <TableRow key={branch.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(branches.from ?? 1) + index}</TableCell>
                                        <TableCell>{branch.code}</TableCell>
                                        <TableCell>
                                            {branch.name}
                                            {branch.is_main ? ' (Main)' : ''}
                                        </TableCell>
                                        <TableCell>{branch.currency}</TableCell>
                                        <TableCell>{branch.departments_count}</TableCell>
                                        <TableCell>{branch.is_active ? 'Active' : 'Inactive'}</TableCell>
                                        <TableCell>{branch.created_at ? new Date(branch.created_at).toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell>
                                            {can('branches.manage') && (
                                                <Link href={`/branches/${branch.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        Edit
                                                    </Button>
                                                </Link>
                                            )}
                                            {can('branches.manage') && (
                                                <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteBranch(branch.id)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {branches.data.length > 0 ? (
                        <TablePagination total={branches.total} from={branches.from} to={branches.to} links={branches.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
