import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface Modifier {
    name: string;
    additional_price: string;
    is_active: boolean;
}

interface MenuItemForm {
    id: number;
    category_id: number;
    order_station_id: number | null;
    code: string | null;
    name: string;
    description: string | null;
    price: string;
    cost_price: string | null;
    preparation_department: string;
    is_available: boolean;
    is_favorite: boolean;
    is_active: boolean;
    modifiers: { name: string; additional_price: string; is_active: boolean }[];
}

interface CategoryOption {
    id: number;
    name: string;
}

interface StationOption {
    id: number;
    name: string;
    code: string;
}

export default function MenuItemFormPage({
    item,
    categories,
    stations,
    departments,
}: {
    item: MenuItemForm | null;
    categories: CategoryOption[];
    stations: StationOption[];
    departments: Record<string, string>;
}) {
    const form = useForm({
        category_id: item?.category_id ? String(item.category_id) : categories[0] ? String(categories[0].id) : '',
        order_station_id: item?.order_station_id ? String(item.order_station_id) : '',
        code: item?.code ?? '',
        name: item?.name ?? '',
        description: item?.description ?? '',
        price: item?.price ? Number(item.price).toFixed(2) : '',
        cost_price: item?.cost_price ? Number(item.cost_price).toFixed(2) : '',
        preparation_department: item?.preparation_department ?? 'kitchen',
        is_available: item?.is_available ?? true,
        is_favorite: item?.is_favorite ?? false,
        is_active: item?.is_active ?? true,
        modifiers: (item?.modifiers ?? []).map((modifier) => ({
            name: modifier.name,
            additional_price: Number(modifier.additional_price).toFixed(2),
            is_active: modifier.is_active,
        })) as Modifier[],
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        if (item) {
            form.put(`/menu/${item.id}`);
            return;
        }
        form.post('/menu');
    }

    function updateModifier(index: number, patch: Partial<Modifier>) {
        form.setData(
            'modifiers',
            form.data.modifiers.map((modifier, modifierIndex) => (modifierIndex === index ? { ...modifier, ...patch } : modifier)),
        );
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Menu & Products', href: '/menu' }, { title: item ? 'Edit Item' : 'Create Item', href: '#' }]}>
            <Head title={item ? 'Edit menu item' : 'Create menu item'} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>{item ? 'Edit Menu Item' : 'Create Menu Item'}</CardTitle>
                        <CardAction>
                            <Link href="/menu">
                                <Button variant="default">Go Back</Button>
                            </Link>
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <form onSubmit={submit} className="grid max-w-2xl gap-4">
                            <div>
                                <Label htmlFor="category_id">Category</Label>
                                <select
                                    id="category_id"
                                    className="border-input mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={form.data.category_id}
                                    onChange={(event) => form.setData('category_id', event.target.value)}
                                >
                                    {categories.length === 0 && <option value="">Add a category first</option>}
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.category_id} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Espresso" />
                                    <InputError message={form.errors.name} />
                                </div>
                                <div>
                                    <Label htmlFor="code">Code</Label>
                                    <Input id="code" value={form.data.code} onChange={(event) => form.setData('code', event.target.value)} placeholder="ESP" />
                                    <InputError message={form.errors.code} />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    className="border-input mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    value={form.data.description}
                                    onChange={(event) => form.setData('description', event.target.value)}
                                />
                                <InputError message={form.errors.description} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="price">Price</Label>
                                    <Input id="price" type="number" min="0" step="0.01" value={form.data.price} onChange={(event) => form.setData('price', event.target.value)} />
                                    <InputError message={form.errors.price} />
                                </div>
                                <div>
                                    <Label htmlFor="cost_price">Cost price</Label>
                                    <Input
                                        id="cost_price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.data.cost_price}
                                        onChange={(event) => form.setData('cost_price', event.target.value)}
                                    />
                                    <InputError message={form.errors.cost_price} />
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="preparation_department">Preparation</Label>
                                    <select
                                        id="preparation_department"
                                        className="border-input mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        value={form.data.preparation_department}
                                        onChange={(event) => form.setData('preparation_department', event.target.value)}
                                    >
                                        {Object.entries(departments).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={form.errors.preparation_department} />
                                </div>
                                <div>
                                    <Label htmlFor="order_station_id">Station</Label>
                                    <select
                                        id="order_station_id"
                                        className="border-input mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        value={form.data.order_station_id}
                                        onChange={(event) => form.setData('order_station_id', event.target.value)}
                                    >
                                        <option value="">Use the category station</option>
                                        {stations.map((station) => (
                                            <option key={station.id} value={station.id}>
                                                {station.name} ({station.code})
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={form.errors.order_station_id} />
                                </div>
                            </div>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.data.is_available} onChange={(event) => form.setData('is_available', event.target.checked)} />
                                    Available
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.data.is_favorite} onChange={(event) => form.setData('is_favorite', event.target.checked)} />
                                    Favorite
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                                    Active
                                </label>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="font-medium">Modifiers</h2>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => form.setData('modifiers', [...form.data.modifiers, { name: '', additional_price: '0.00', is_active: true }])}
                                    >
                                        Add modifier
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {form.data.modifiers.map((modifier, index) => (
                                        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-center">
                                            <Input value={modifier.name} placeholder="Extra shot" onChange={(event) => updateModifier(index, { name: event.target.value })} />
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={modifier.additional_price}
                                                onChange={(event) => updateModifier(index, { additional_price: event.target.value })}
                                            />
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={modifier.is_active} onChange={(event) => updateModifier(index, { is_active: event.target.checked })} />
                                                Active
                                            </label>
                                            <Button type="button" variant="outline" size="sm" onClick={() => form.setData('modifiers', form.data.modifiers.filter((_, modifierIndex) => modifierIndex !== index))}>
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                    {form.data.modifiers.length === 0 && <p className="text-muted-foreground text-sm">No modifiers yet.</p>}
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button size="lg" type="submit" disabled={form.processing || categories.length === 0}>
                                    {item ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
