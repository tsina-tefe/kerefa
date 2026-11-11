import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';

interface Permission {
    name: string;
    module: string | null;
    description: string | null;
}

export default function RoleEdit({
    role,
    permissions,
}: {
    role: { id: number; name: string; label: string; description: string | null; permissions: string[] } | null;
    permissions: Permission[];
}) {
    const locked = role?.name === 'super-admin';
    const form = useForm({
        label: role?.label ?? '',
        description: role?.description ?? '',
        permissions: role?.permissions ?? [],
    });

    const modules = permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
        const module = permission.module || 'general';
        groups[module] = groups[module] ?? [];
        groups[module].push(permission);
        return groups;
    }, {});

    function toggle(name: string) {
        if (locked) {
            return;
        }
        form.setData('permissions', form.data.permissions.includes(name) ? form.data.permissions.filter((item) => item !== name) : [...form.data.permissions, name]);
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Roles', href: '/roles' }, { title: role ? role.label : 'Add New', href: '#' }]}>
            <Head title={role ? `Edit ${role.label}` : 'Add role'} />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (role) {
                        form.put(`/roles/${role.id}`);
                        return;
                    }
                    form.post('/roles');
                }}
                className="mx-auto flex max-w-4xl flex-col gap-4 p-4"
            >
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">{role ? role.label : 'Add role'}</h1>
                    <Link href="/roles" className="text-sm underline-offset-4 hover:underline">
                        Back
                    </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label>Display name</Label>
                        <Input value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} disabled={locked} />
                        <InputError message={form.errors.label} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} disabled={locked} />
                    </div>
                </div>

                {locked && <p className="text-sm text-amber-700">This role keeps every permission so the system always has an administrator.</p>}

                {Object.entries(modules).map(([module, items]) => (
                    <fieldset key={module} className="rounded-xl border p-4">
                        <legend className="px-1 text-sm font-medium capitalize">{module}</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {items.map((permission) => (
                                <label key={permission.name} className="flex items-start gap-2 text-sm">
                                    <input type="checkbox" className="mt-1" checked={form.data.permissions.includes(permission.name)} disabled={locked} onChange={() => toggle(permission.name)} />
                                    <span>
                                        <span className="font-medium">{permission.name}</span>
                                        {permission.description && <span className="text-muted-foreground block">{permission.description}</span>}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ))}

                {!locked && (
                    <Button type="submit" disabled={form.processing} className="w-fit">
                        {role ? 'Save role' : 'Create role'}
                    </Button>
                )}
            </form>
        </AppLayout>
    );
}
