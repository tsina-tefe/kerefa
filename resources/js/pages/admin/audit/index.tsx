import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface LogRow {
    id: number;
    action: string;
    module: string;
    description: string | null;
    created_at: string;
    user?: { name: string; username: string } | null;
    branch?: { name: string } | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export default function AuditIndex({
    logs,
    modules,
    filters,
}: {
    logs: Paginator<LogRow>;
    modules: string[];
    filters: { module: string; search: string };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [module, setModule] = useState(filters.module ?? '');

    function submit(event: FormEvent) {
        event.preventDefault();
        router.get('/audit-logs', { search, module }, { preserveState: true, replace: true });
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Audit trail', href: '/audit-logs' }]}>
            <Head title="Audit trail" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Audit Trail</CardTitle>
                        <form className="ml-4 flex flex-wrap gap-2" onSubmit={submit}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description or action" />
                            <select value={module} onChange={(event) => setModule(event.target.value)} className="border-input h-10 rounded-md border px-3 text-sm">
                                <option value="">All modules</option>
                                {modules.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
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
                                    <TableHead className="font-bold text-white">ID</TableHead>
                                    <TableHead className="font-bold text-white">When</TableHead>
                                    <TableHead className="font-bold text-white">User</TableHead>
                                    <TableHead className="font-bold text-white">Branch</TableHead>
                                    <TableHead className="font-bold text-white">Module</TableHead>
                                    <TableHead className="font-bold text-white">Action</TableHead>
                                    <TableHead className="font-bold text-white">What happened</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.data.map((log, index) => (
                                    <TableRow key={log.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(logs.from ?? 1) + index}</TableCell>
                                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                        <TableCell>{log.user?.name ?? 'System'}</TableCell>
                                        <TableCell>{log.branch?.name || 'N/A'}</TableCell>
                                        <TableCell>{log.module}</TableCell>
                                        <TableCell>{log.action}</TableCell>
                                        <TableCell>{log.description || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {logs.data.length > 0 ? (
                        <TablePagination total={logs.total} from={logs.from} to={logs.to} links={logs.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
