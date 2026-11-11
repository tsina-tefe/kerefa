import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';

interface Setting {
    key: string;
    value: string | null;
    type: string;
    category: string;
    description: string | null;
}

export default function SettingsIndex({ settings, canManage }: { settings: Setting[]; canManage: boolean }) {
    const initial = Object.fromEntries(settings.map((setting) => [setting.key, setting.value ?? '']));
    const form = useForm<{ settings: Record<string, string> }>({ settings: initial });

    return (
        <AppLayout breadcrumbs={[{ title: 'Settings', href: '/system-settings' }]}>
            <Head title="Settings" />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put('/system-settings');
                }}
                className="mx-auto flex max-w-2xl flex-col gap-4 p-4"
            >
                <div>
                    <h1 className="text-2xl font-semibold">Settings</h1>
                    <p className="text-muted-foreground text-sm">Currency, tax, and the system name.</p>
                </div>
                {settings.map((setting) => (
                    <div key={setting.key} className="grid gap-2">
                        <Label htmlFor={setting.key}>{setting.description || setting.key}</Label>
                        {setting.type === 'boolean' ? (
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    id={setting.key}
                                    type="checkbox"
                                    checked={form.data.settings[setting.key] === '1'}
                                    disabled={!canManage || setting.key === 'bill_generation_enabled'}
                                    onChange={(event) => form.setData('settings', { ...form.data.settings, [setting.key]: event.target.checked ? '1' : '0' })}
                                />
                                Enabled
                            </label>
                        ) : (
                            <Input
                                id={setting.key}
                                value={form.data.settings[setting.key] ?? ''}
                                disabled={!canManage}
                                onChange={(event) => form.setData('settings', { ...form.data.settings, [setting.key]: event.target.value })}
                            />
                        )}
                    </div>
                ))}
                {canManage && (
                    <Button type="submit" disabled={form.processing} className="w-fit">
                        Save settings
                    </Button>
                )}
            </form>
        </AppLayout>
    );
}
