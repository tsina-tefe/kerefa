import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';

interface Option {
    id: number;
    name: string;
    code?: string;
    branch_id?: number | null;
    label?: string | null;
}

interface UserFormData {
    name: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
    branch_id: string;
    department_id: string;
    is_active: boolean;
    roles: string[];
    accessible_branches: number[];
}

export default function UserForm({
    user,
    branches,
    departments,
    roles,
}: {
    user: (Omit<UserFormData, 'password' | 'password_confirmation' | 'branch_id' | 'department_id'> & {
        id: number;
        branch_id: number | null;
        department_id: number | null;
    }) | null;
    branches: Option[];
    departments: Option[];
    roles: Option[];
}) {
    const form = useForm<UserFormData>({
        name: user?.name ?? '',
        username: user?.username ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        password: '',
        password_confirmation: '',
        branch_id: user?.branch_id ? String(user.branch_id) : '',
        department_id: user?.department_id ? String(user.department_id) : '',
        is_active: user?.is_active ?? true,
        roles: user?.roles ?? [],
        accessible_branches: user?.accessible_branches ?? [],
    });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        if (user) {
            form.put(`/users/${user.id}`);
            return;
        }
        form.post('/users');
    }

    function toggleRole(name: string) {
        form.setData('roles', form.data.roles.includes(name) ? form.data.roles.filter((role) => role !== name) : [...form.data.roles, name]);
    }

    function toggleBranch(id: number) {
        const selected = form.data.accessible_branches;
        form.setData('accessible_branches', selected.includes(id) ? selected.filter((branchId) => branchId !== id) : [...selected, id]);
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Users', href: '/users' }, { title: user ? 'Edit' : 'Create', href: '#' }]}>
            <Head title={user ? 'Edit user' : 'Add user'} />
            <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">{user ? 'Edit user' : 'Add user'}</h1>
                    <Link href="/users" className="text-sm underline-offset-4 hover:underline">
                        Back
                    </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" error={form.errors.name}>
                        <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                    </Field>
                    <Field label="Username" error={form.errors.username}>
                        <Input value={form.data.username} onChange={(event) => form.setData('username', event.target.value)} required />
                    </Field>
                    <Field label="Email" error={form.errors.email}>
                        <Input type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} required />
                    </Field>
                    <Field label="Phone" error={form.errors.phone}>
                        <Input value={form.data.phone} onChange={(event) => form.setData('phone', event.target.value)} />
                    </Field>
                    <Field label={user ? 'New password' : 'Password'} error={form.errors.password}>
                        <Input type="password" value={form.data.password} onChange={(event) => form.setData('password', event.target.value)} required={!user} />
                    </Field>
                    <Field label="Confirm password" error={form.errors.password_confirmation}>
                        <Input type="password" value={form.data.password_confirmation} onChange={(event) => form.setData('password_confirmation', event.target.value)} required={!user} />
                    </Field>
                    <Field label="Home branch" error={form.errors.branch_id}>
                        <select className="border-input h-10 rounded-md border px-3 text-sm" value={form.data.branch_id} onChange={(event) => form.setData('branch_id', event.target.value)} required>
                            <option value="">Select a branch</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Department" error={form.errors.department_id}>
                        <select className="border-input h-10 rounded-md border px-3 text-sm" value={form.data.department_id} onChange={(event) => form.setData('department_id', event.target.value)}>
                            <option value="">None</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                    Active
                </label>

                <fieldset className="rounded-xl border p-4">
                    <legend className="px-1 text-sm font-medium">Roles</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {roles.map((role) => (
                            <label key={role.name} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.data.roles.includes(role.name)} onChange={() => toggleRole(role.name)} />
                                {role.label || role.name}
                            </label>
                        ))}
                    </div>
                    <InputError message={form.errors.roles} className="mt-2" />
                </fieldset>

                <fieldset className="rounded-xl border p-4">
                    <legend className="px-1 text-sm font-medium">Extra branch access</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {branches.map((branch) => (
                            <label key={branch.id} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.data.accessible_branches.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                                {branch.name}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <Button type="submit" disabled={form.processing} className="w-fit">
                    {user ? 'Save user' : 'Create user'}
                </Button>
            </form>
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
