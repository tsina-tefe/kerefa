import InputError from '@/components/input-error';
import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface CategoryRow {
    id: number;
    name: string;
    is_active: boolean;
    order_station_id: number | null;
    menu_items_count: number;
    order_station?: { id: number; name: string } | null;
}

interface ItemRow {
    id: number;
    code: string | null;
    name: string;
    price: string;
    preparation_department: string;
    is_available: boolean;
    is_favorite: boolean;
    is_active: boolean;
    modifiers_count: number;
    category: { id: number; name: string } | null;
}

interface StationOption {
    id: number;
    name: string;
    code: string;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

const emptyCategory = { id: 0, name: '', order_station_id: '', is_active: true };

export default function MenuIndex({
    items,
    categories,
    stations,
    filters,
}: {
    items: Paginator<ItemRow>;
    categories: CategoryRow[];
    stations: StationOption[];
    filters: { search: string; category_id: string };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? '');
    const [addingCategory, setAddingCategory] = useState(false);
    const [editingCategory, setEditingCategory] = useState(false);
    const categoryForm = useForm(emptyCategory);

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/menu', { search, category_id: categoryId }, { preserveState: true, replace: true });
    }

    function openAddCategory() {
        categoryForm.setData(emptyCategory);
        categoryForm.clearErrors();
        setAddingCategory(true);
    }

    function openEditCategory(category: CategoryRow) {
        categoryForm.setData({
            id: category.id,
            name: category.name,
            order_station_id: category.order_station_id ? String(category.order_station_id) : '',
            is_active: category.is_active,
        });
        categoryForm.clearErrors();
        setEditingCategory(true);
    }

    function createCategory(event: FormEvent) {
        event.preventDefault();
        categoryForm.post('/menu-categories', {
            onSuccess: () => {
                categoryForm.reset();
                setAddingCategory(false);
            },
        });
    }

    function updateCategory(event: FormEvent) {
        event.preventDefault();
        categoryForm.put(`/menu-categories/${categoryForm.data.id}`, {
            onSuccess: () => setEditingCategory(false),
        });
    }

    function deleteCategory(id: number) {
        if (confirm('Are you sure you want to delete this category?')) {
            router.delete(`/menu-categories/${id}`);
        }
    }

    function deleteItem(id: number) {
        if (confirm('Are you sure you want to delete this menu item?')) {
            router.delete(`/menu/${id}`);
        }
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Menu & Products', href: '/menu' }]}>
            <Head title="Menu & Products" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Categories</CardTitle>
                        <CardAction>
                            <Button variant="default" onClick={openAddCategory}>
                                Add New
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Station</TableHead>
                                    <TableHead className="font-bold text-white">Items</TableHead>
                                    <TableHead className="font-bold text-white">Active</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{category.name}</TableCell>
                                        <TableCell>{category.order_station?.name || 'N/A'}</TableCell>
                                        <TableCell>{category.menu_items_count}</TableCell>
                                        <TableCell>{category.is_active ? 'Yes' : 'No'}</TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => openEditCategory(category)}>
                                                Edit
                                            </Button>
                                            <Button className="m-2" variant="destructive" size="sm" onClick={() => deleteCategory(category.id)}>
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {categories.length === 0 && <div className="flex h-full items-center justify-center p-6">No Results Found!</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle>Menu & Products</CardTitle>
                        <form className="ml-4 flex flex-wrap gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu items..." />
                            <select
                                className="border-input h-10 rounded-md border bg-background px-3 text-sm"
                                value={categoryId}
                                onChange={(event) => setCategoryId(event.target.value)}
                            >
                                <option value="">All categories</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <Button type="submit" variant="outline">
                                Search
                            </Button>
                        </form>
                        <CardAction>
                            <Link href="/menu/create">
                                <Button variant="default">Add New</Button>
                            </Link>
                        </CardAction>
                    </CardHeader>
                    <hr />
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">ID</TableHead>
                                    <TableHead className="font-bold text-white">Code</TableHead>
                                    <TableHead className="font-bold text-white">Name</TableHead>
                                    <TableHead className="font-bold text-white">Category</TableHead>
                                    <TableHead className="font-bold text-white">Price</TableHead>
                                    <TableHead className="font-bold text-white">Station</TableHead>
                                    <TableHead className="font-bold text-white">Available</TableHead>
                                    <TableHead className="font-bold text-white">Favorite</TableHead>
                                    <TableHead className="font-bold text-white">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.data.map((item, index) => (
                                    <TableRow key={item.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell>{(items.from ?? 1) + index}</TableCell>
                                        <TableCell>{item.code || 'N/A'}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.category?.name || 'N/A'}</TableCell>
                                        <TableCell>{Number(item.price).toFixed(2)}</TableCell>
                                        <TableCell className="capitalize">{item.preparation_department}</TableCell>
                                        <TableCell>{item.is_available ? 'Yes' : 'Sold out'}</TableCell>
                                        <TableCell>
                                            <Button variant={item.is_favorite ? 'default' : 'outline'} size="sm" onClick={() => router.post(`/menu/${item.id}/toggle-favorite`)}>
                                                {item.is_favorite ? 'Yes' : 'No'}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => router.post(`/menu/${item.id}/toggle-availability`)}>
                                                {item.is_available ? 'Sold out' : 'Available'}
                                            </Button>
                                            <Link href={`/menu/${item.id}/edit`}>
                                                <Button className="m-2" variant="outline" size="sm">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button variant="destructive" size="sm" onClick={() => deleteItem(item.id)}>
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {items.data.length > 0 ? (
                        <TablePagination total={items.total} from={items.from} to={items.to} links={items.links} />
                    ) : (
                        <div className="flex h-full items-center justify-center p-6">No Results Found!</div>
                    )}
                </Card>

                <CategoryDialog
                    open={addingCategory}
                    title="Add New Category"
                    submitLabel="Create"
                    form={categoryForm}
                    stations={stations}
                    onOpenChange={setAddingCategory}
                    onSubmit={createCategory}
                />
                <CategoryDialog
                    open={editingCategory}
                    title="Edit Category"
                    submitLabel="Update"
                    form={categoryForm}
                    stations={stations}
                    onOpenChange={setEditingCategory}
                    onSubmit={updateCategory}
                />
            </div>
        </AppLayout>
    );
}

function CategoryDialog({
    open,
    title,
    submitLabel,
    form,
    stations,
    onOpenChange,
    onSubmit,
}: {
    open: boolean;
    title: string;
    submitLabel: string;
    stations: StationOption[];
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: FormEvent) => void;
    form: {
        data: typeof emptyCategory;
        errors: Partial<Record<keyof typeof emptyCategory, string>>;
        processing: boolean;
        setData: (key: keyof typeof emptyCategory, value: string | number | boolean) => void;
    };
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <hr />
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4">
                        <div className="grid gap-3">
                            <Label htmlFor="category-name">Name</Label>
                            <Input id="category-name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Hot drinks" />
                            <InputError message={form.errors.name} />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="category-station">Station</Label>
                            <select
                                id="category-station"
                                className="border-input h-10 rounded-md border bg-background px-3 text-sm"
                                value={form.data.order_station_id}
                                onChange={(event) => form.setData('order_station_id', event.target.value)}
                            >
                                <option value="">No station</option>
                                {stations.map((station) => (
                                    <option key={station.id} value={station.id}>
                                        {station.name} ({station.code})
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.order_station_id} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                            Active
                        </label>
                    </div>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button variant="outline" type="button">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Loader2 className="animate-spin" />}
                            <span>{submitLabel}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
