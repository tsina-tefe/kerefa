import InputError from '@/components/input-error';
import TablePagination from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface CategoryRow {
    id: number;
    name: string;
    code: string;
    items_count: number;
}

interface ItemRow {
    id: number;
    code: string;
    name: string;
    unit: string;
    unit_cost: number;
    current_stock: number;
    min_stock_level: number;
    stock_value: number;
    is_low: boolean;
    category: { id: number; name: string } | null;
}

interface MovementRow {
    id: number;
    type: string;
    quantity: number;
    balance_after: number;
    notes: string | null;
    created_at: string | null;
    item: string | null;
    unit: string | null;
    user: string | null;
}

interface Paginator<T> {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

const money = (value: number) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryIndex({
    items,
    categories,
    movements,
    stats,
    filters,
    can,
}: {
    items: Paginator<ItemRow>;
    categories: CategoryRow[];
    movements: MovementRow[];
    stats: { total_items: number; low_stock_count: number; valuation: number };
    filters: { search: string; category_id: string };
    can: { manage: boolean; adjust: boolean };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? '');
    const [addingCategory, setAddingCategory] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
    const [addingItem, setAddingItem] = useState(false);
    const [adjusting, setAdjusting] = useState<ItemRow | null>(null);
    const categoryForm = useForm({ name: '', description: '' });
    const itemForm = useForm({ category_id: '', code: '', name: '', unit: 'kg', unit_cost: '', min_stock_level: '0' });
    const adjustForm = useForm({ type: 'in', quantity: '', notes: '' });

    function submitSearch(event: FormEvent) {
        event.preventDefault();
        router.get('/inventory', { search, category_id: categoryId }, { preserveState: true, replace: true });
    }

    function createCategory(event: FormEvent) {
        event.preventDefault();
        categoryForm.post('/inventory-categories', {
            onSuccess: () => {
                categoryForm.reset();
                setAddingCategory(false);
            },
        });
    }

    function openEditCategory(category: CategoryRow) {
        categoryForm.setData({ name: category.name, description: '' });
        categoryForm.clearErrors();
        setEditingCategory(category);
    }

    function updateCategory(event: FormEvent) {
        event.preventDefault();
        if (!editingCategory) return;
        categoryForm.put(`/inventory-categories/${editingCategory.id}`, {
            onSuccess: () => {
                categoryForm.reset();
                setEditingCategory(null);
            },
        });
    }

    function createItem(event: FormEvent) {
        event.preventDefault();
        itemForm.post('/inventory', {
            onSuccess: () => {
                itemForm.reset();
                itemForm.setData('unit', 'kg');
                itemForm.setData('min_stock_level', '0');
                setAddingItem(false);
            },
        });
    }

    function adjustStock(event: FormEvent) {
        event.preventDefault();
        if (!adjusting) return;
        adjustForm.post(`/inventory/${adjusting.id}/adjust`, {
            onSuccess: () => {
                adjustForm.reset();
                adjustForm.setData('type', 'in');
                setAdjusting(null);
            },
        });
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Stock & Inventory', href: '/inventory' }]}>
            <Head title="Stock & Inventory" />
            <div className="flex h-full flex-1 flex-col gap-2 overflow-x-auto rounded-xl p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Items</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold">{stats.total_items}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Low stock</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold text-red-600">{stats.low_stock_count}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="px-3 py-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Stock value</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 text-2xl font-semibold">ETB {money(stats.valuation)}</CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-3 py-2">
                        <CardTitle className="text-base">Categories</CardTitle>
                        {can.manage && (
                            <CardAction>
                                <Button onClick={() => setAddingCategory(true)}>Add category</Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent className="px-3 pb-3">
                        <div className="flex flex-wrap gap-2">
                            {categories.map((category) => (
                                <span key={category.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                                    {category.name} ({category.items_count})
                                    {can.manage && (
                                        <button type="button" className="font-medium text-primary" onClick={() => openEditCategory(category)}>
                                            Edit
                                        </button>
                                    )}
                                </span>
                            ))}
                            {categories.length === 0 && <p className="text-muted-foreground text-sm">No categories yet.</p>}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-3 py-2">
                        <CardTitle className="text-base">Stock</CardTitle>
                        <form className="ml-4 flex flex-wrap gap-2" onSubmit={submitSearch}>
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code" />
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
                        {can.manage && (
                            <CardAction>
                                <Button onClick={() => setAddingItem(true)}>Add item</Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <hr />
                    <CardContent className="px-3 pb-3">
                        <Table>
                            <TableHeader className="bg-slate-500 dark:bg-slate-700">
                                <TableRow>
                                    <TableHead className="font-bold text-white">Code</TableHead>
                                    <TableHead className="font-bold text-white">Item</TableHead>
                                    <TableHead className="font-bold text-white">Category</TableHead>
                                    <TableHead className="font-bold text-white">On hand</TableHead>
                                    <TableHead className="font-bold text-white">Minimum</TableHead>
                                    <TableHead className="font-bold text-white">Unit cost</TableHead>
                                    <TableHead className="font-bold text-white">Value</TableHead>
                                    <TableHead className="font-bold text-white">Status</TableHead>
                                    {can.adjust && <TableHead className="font-bold text-white">Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.data.map((item) => (
                                    <TableRow key={item.id} className="odd:bg-slate-100 dark:odd:bg-slate-800">
                                        <TableCell className="font-mono">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.category?.name || '—'}</TableCell>
                                        <TableCell className={item.is_low ? 'font-semibold text-red-600' : ''}>
                                            {money(item.current_stock)} {item.unit}
                                        </TableCell>
                                        <TableCell>
                                            {money(item.min_stock_level)} {item.unit}
                                        </TableCell>
                                        <TableCell>ETB {money(item.unit_cost)}</TableCell>
                                        <TableCell>ETB {money(item.stock_value)}</TableCell>
                                        <TableCell>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.is_low ? 'Low' : 'In stock'}
                                            </span>
                                        </TableCell>
                                        {can.adjust && (
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => setAdjusting(item)}>
                                                    Adjust
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {items.data.length === 0 && <div className="p-6 text-center text-muted-foreground">No stock items found.</div>}
                        <TablePagination links={items.links} total={items.total} from={items.from} to={items.to} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="px-3 py-2">
                        <CardTitle className="text-base">Recent movements</CardTitle>
                    </CardHeader>
                    <hr />
                    <CardContent className="px-3 pb-3">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>When</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movements.map((movement) => (
                                    <TableRow key={movement.id}>
                                        <TableCell className="font-mono text-xs">{movement.created_at}</TableCell>
                                        <TableCell>{movement.item}</TableCell>
                                        <TableCell className="uppercase">{movement.type}</TableCell>
                                        <TableCell>
                                            {money(movement.quantity)} {movement.unit}
                                        </TableCell>
                                        <TableCell>{money(movement.balance_after)}</TableCell>
                                        <TableCell>{movement.user || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {movements.length === 0 && <div className="p-6 text-center text-muted-foreground">No stock movements yet.</div>}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={addingCategory} onOpenChange={setAddingCategory}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={createCategory} className="space-y-3">
                        <div>
                            <Label htmlFor="category-name">Name</Label>
                            <Input id="category-name" value={categoryForm.data.name} onChange={(event) => categoryForm.setData('name', event.target.value)} />
                            <InputError message={categoryForm.errors.name} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={categoryForm.processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={editingCategory !== null} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={updateCategory} className="space-y-3">
                        <div>
                            <Label htmlFor="edit-category-name">Name</Label>
                            <Input id="edit-category-name" value={categoryForm.data.name} onChange={(event) => categoryForm.setData('name', event.target.value)} />
                            <InputError message={categoryForm.errors.name} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={categoryForm.processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={addingItem} onOpenChange={setAddingItem}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add stock item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={createItem} className="space-y-3">
                        <div>
                            <Label htmlFor="item-category">Category</Label>
                            <select
                                id="item-category"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={itemForm.data.category_id}
                                onChange={(event) => itemForm.setData('category_id', event.target.value)}
                            >
                                <option value="">Select</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={itemForm.errors.category_id} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="item-code">Code</Label>
                                <Input id="item-code" value={itemForm.data.code} onChange={(event) => itemForm.setData('code', event.target.value)} />
                                <InputError message={itemForm.errors.code} />
                            </div>
                            <div>
                                <Label htmlFor="item-unit">Unit</Label>
                                <Input id="item-unit" value={itemForm.data.unit} onChange={(event) => itemForm.setData('unit', event.target.value)} />
                                <InputError message={itemForm.errors.unit} />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="item-name">Name</Label>
                            <Input id="item-name" value={itemForm.data.name} onChange={(event) => itemForm.setData('name', event.target.value)} />
                            <InputError message={itemForm.errors.name} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="item-cost">Unit cost</Label>
                                <Input id="item-cost" type="number" min="0" step="0.01" value={itemForm.data.unit_cost} onChange={(event) => itemForm.setData('unit_cost', event.target.value)} />
                                <InputError message={itemForm.errors.unit_cost} />
                            </div>
                            <div>
                                <Label htmlFor="item-min">Minimum</Label>
                                <Input id="item-min" type="number" min="0" step="0.01" value={itemForm.data.min_stock_level} onChange={(event) => itemForm.setData('min_stock_level', event.target.value)} />
                                <InputError message={itemForm.errors.min_stock_level} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={itemForm.processing}>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={adjusting !== null} onOpenChange={(open) => !open && setAdjusting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust {adjusting?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={adjustStock} className="space-y-3">
                        <div>
                            <Label htmlFor="adjust-type">Type</Label>
                            <select
                                id="adjust-type"
                                className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={adjustForm.data.type}
                                onChange={(event) => adjustForm.setData('type', event.target.value)}
                            >
                                <option value="in">Stock in</option>
                                <option value="out">Stock out</option>
                                <option value="wastage">Wastage</option>
                                <option value="adjustment">Adjustment</option>
                            </select>
                            <InputError message={adjustForm.errors.type} />
                        </div>
                        <div>
                            <Label htmlFor="adjust-qty">Quantity ({adjusting?.unit})</Label>
                            <Input id="adjust-qty" type="number" min="0.01" step="0.01" value={adjustForm.data.quantity} onChange={(event) => adjustForm.setData('quantity', event.target.value)} />
                            <InputError message={adjustForm.errors.quantity} />
                        </div>
                        <div>
                            <Label htmlFor="adjust-notes">Note</Label>
                            <Input id="adjust-notes" value={adjustForm.data.notes} onChange={(event) => adjustForm.setData('notes', event.target.value)} />
                            <InputError message={adjustForm.errors.notes} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={adjustForm.processing}>
                                Confirm
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
