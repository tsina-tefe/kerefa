import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface DepartmentFormData {
    id: number;
    branch_id: number;
    code: string;
    name: string;
    type: string;
    is_active: boolean;
}

interface BranchOption {
    id: number;
    name: string;
    code: string;
}

export default function DepartmentFormPage({
    department,
    branches,
    types,
}: {
    department: DepartmentFormData | null;
    branches: BranchOption[];
    types: Record<string, string>;
}) {
    const form = useForm({
        branch_id: department?.branch_id ? String(department.branch_id) : branches[0] ? String(branches[0].id) : '',
        code: department?.code ?? '',
        name: department?.name ?? '',
        type: department?.type ?? 'general',
        is_active: department?.is_active ?? true,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        if (department) {
            form.put(`/departments/${department.id}`);
            return;
        }
        form.post('/departments');
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Departments', href: '/departments' }, { title: department ? 'Edit Department' : 'Create Department', href: '#' }]}>
            <Head title={department ? 'Edit Department' : 'Create Department'} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>{department ? 'Edit Department' : 'Create Department'}</CardTitle>
                        <CardAction>
                            <Link href="/departments">
                                <Button variant="default">Go Back</Button>
                            </Link>
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <form onSubmit={submit} className="grid max-w-xl gap-4">
                            <div>
                                <Label htmlFor="branch_id">Branch</Label>
                                <select
                                    id="branch_id"
                                    className="border-input mt-1 h-10 w-full rounded-md border px-3 text-sm"
                                    value={form.data.branch_id}
                                    onChange={(event) => form.setData('branch_id', event.target.value)}
                                >
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name} ({branch.code})
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.branch_id} />
                            </div>
                            <div>
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Enter department name" />
                                <InputError message={form.errors.name} />
                            </div>
                            <div>
                                <Label htmlFor="code">Code</Label>
                                <Input id="code" value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} placeholder="DIN" />
                                <InputError message={form.errors.code} />
                            </div>
                            <div>
                                <Label htmlFor="type">Type</Label>
                                <select
                                    id="type"
                                    className="border-input mt-1 h-10 w-full rounded-md border px-3 text-sm"
                                    value={form.data.type}
                                    onChange={(event) => form.setData('type', event.target.value)}
                                >
                                    {Object.entries(types).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input id="is_active" type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                                Active
                            </label>
                            <InputError message={form.errors.is_active} />
                            <div className="flex justify-end">
                                <Button size="lg" type="submit" disabled={form.processing}>
                                    {department ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
