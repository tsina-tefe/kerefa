import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';

interface Department {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface BranchForm {
    id: number;
    code: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    is_main: boolean;
    is_active: boolean;
    departments?: Department[];
}

export default function BranchFormPage({ branch }: { branch: BranchForm | null }) {
    const form = useForm({
        code: branch?.code ?? '',
        name: branch?.name ?? '',
        address: branch?.address ?? '',
        phone: branch?.phone ?? '',
        email: branch?.email ?? '',
        currency: branch?.currency ?? 'ETB',
        is_main: branch?.is_main ?? false,
        is_active: branch?.is_active ?? true,
    });

    const departmentForm = useForm({
        code: '',
        name: '',
        type: 'general',
    });

    return (
        <AppLayout breadcrumbs={[{ title: 'Branches', href: '/branches' }, { title: branch ? branch.name : 'Create', href: '#' }]}>
            <Head title={branch ? 'Edit branch' : 'Add branch'} />
            <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">{branch ? 'Edit branch' : 'Add branch'}</h1>
                    <Link href="/branches" className="text-sm underline-offset-4 hover:underline">
                        Back
                    </Link>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (branch) {
                            form.put(`/branches/${branch.id}`);
                            return;
                        }
                        form.post('/branches');
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <Field label="Name" error={form.errors.name}>
                        <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                    </Field>
                    <Field label="Code" error={form.errors.code}>
                        <Input value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} required />
                    </Field>
                    <Field label="Phone" error={form.errors.phone}>
                        <Input value={form.data.phone} onChange={(event) => form.setData('phone', event.target.value)} />
                    </Field>
                    <Field label="Email" error={form.errors.email}>
                        <Input type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} />
                    </Field>
                    <Field label="Currency" error={form.errors.currency}>
                        <Input value={form.data.currency} onChange={(event) => form.setData('currency', event.target.value)} required />
                    </Field>
                    <Field label="Address" error={form.errors.address}>
                        <Input value={form.data.address} onChange={(event) => form.setData('address', event.target.value)} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.data.is_main} onChange={(event) => form.setData('is_main', event.target.checked)} />
                        Main branch
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                        Active
                    </label>
                    <Button type="submit" disabled={form.processing} className="w-fit">
                        {branch ? 'Save branch' : 'Create branch'}
                    </Button>
                </form>

                {branch && (
                    <div className="rounded-xl border p-4">
                        <h2 className="font-medium">Departments</h2>
                        <ul className="mt-3 space-y-1 text-sm">
                            {(branch.departments ?? []).map((department) => (
                                <li key={department.id}>
                                    {department.name} <span className="text-muted-foreground">({department.code}, {department.type})</span>
                                </li>
                            ))}
                            {(branch.departments ?? []).length === 0 && <li className="text-muted-foreground">No departments yet.</li>}
                        </ul>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                departmentForm.post(`/branches/${branch.id}/departments`, {
                                    onSuccess: () => departmentForm.reset(),
                                });
                            }}
                            className="mt-4 grid gap-3 sm:grid-cols-4"
                        >
                            <Input placeholder="Name" value={departmentForm.data.name} onChange={(event) => departmentForm.setData('name', event.target.value)} required />
                            <Input placeholder="Code" value={departmentForm.data.code} onChange={(event) => departmentForm.setData('code', event.target.value)} required />
                            <select className="border-input h-10 rounded-md border px-3 text-sm" value={departmentForm.data.type} onChange={(event) => departmentForm.setData('type', event.target.value)}>
                                {['kitchen', 'bar', 'dining', 'inventory', 'admin', 'general'].map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                            <Button type="submit" variant="outline" disabled={departmentForm.processing}>
                                Add
                            </Button>
                            <InputError message={departmentForm.errors.name || departmentForm.errors.code} />
                        </form>
                    </div>
                )}
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
