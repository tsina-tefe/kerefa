import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { buildIrp200dTicketHtml, buildIrp200dSettlementReceiptHtml, printIrp200d } from './thermalPrinter';

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundQty(value) {
    return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function parseQtyInput(raw) {
    const trimmed = String(raw ?? '').trim().replace(',', '.');
    if (trimmed === '' || trimmed === '.' || trimmed === '-' || trimmed === '-.') {
        return { ok: false };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return { ok: false };
    }
    return { ok: true, value: roundQty(parsed) };
}

function referenceStatusLabel(status) {
    if (status === 'completed') {
        return { label: 'PAID / SETTLED', short: 'PAID', className: 'bg-success' };
    }
    if (status === 'cancelled') {
        return { label: 'CANCELLED', short: 'CANCELLED', className: 'bg-danger' };
    }
    return { label: 'HELD / OPEN', short: 'HELD', className: 'bg-warning text-dark' };
}

// Audio Synthesizer for Tactile POS Feedback
function playPosSound(type = 'add') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'add') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
            osc.start();
            osc.stop(ctx.currentTime + 0.14);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
            gain.gain.setValueAtTime(0.09, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
            osc.start();
            osc.stop(ctx.currentTime + 0.32);
        } else if (type === 'void') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, ctx.currentTime);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        }
    } catch {
        // Audio muted or not permitted
    }
}

export default function PosApp({ initialData }) {
    // Initial Data
    const branch = initialData.branch || { id: 1, name: 'Main Branch' };
    const user = initialData.user || { id: 1, name: 'Cashier' };
    const roleName = initialData.role || 'Staff';
    const categories = initialData.categories || [];
    const diningAreas = initialData.diningAreas || [];
    const initialOrders = initialData.recentOrders || [];
    const waitersList = initialData.waiters || [];
    const routes = initialData.routes || {};
    const csrfToken = initialData.csrfToken || '';
    const appName = initialData.appName || 'QEREFA';
    const serviceChargeRate = Number(initialData.serviceChargeRate ?? 10);
    const vatRate = Number(initialData.vatRate ?? 15);

    // Access Control & Permission Verifier
    const permissions = useMemo(() => initialData.permissions || ['*'], [initialData.permissions]);
    const can = useCallback((perm) => {
        if (!permissions || permissions.length === 0) return true;
        if (permissions.includes('*')) return true;
        return permissions.includes(perm);
    }, [permissions]);

    // Top Navigation Tabs (Matches Reference POS Layout Exactly)
    // 'RMS' | 'CATEGORY' | 'REFERENCE' | 'FAVORITE' | 'SEARCH' | 'EXIT'
    const [activeTopTab, setActiveTopTab] = useState('RMS');

    // RMS Sub-Navigation Tabs: 'TABLE' | 'WAITERS'
    const [rmsSubTab, setRmsSubTab] = useState('TABLE');
    const tabRowRef = useRef(null);
    const rmsTabRef = useRef(null);
    const [rmsTabOffset, setRmsTabOffset] = useState(0);

    useLayoutEffect(() => {
        const measure = () => {
            const row = tabRowRef.current;
            const tab = rmsTabRef.current;
            if (!row || !tab) return;
            setRmsTabOffset(tab.getBoundingClientRect().left - row.getBoundingClientRect().left);
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [activeTopTab]);

    const [selectedReferenceOrder, setSelectedReferenceOrder] = useState(null);

    // Category / Item Navigation
    const [selectedCategory, setSelectedCategory] = useState(null); // null = categories grid, object = items
    const [searchQuery, setSearchQuery] = useState('');

    // Order Specifications
    const [orderType, setOrderType] = useState('dine_in');
    const [selectedTable, setSelectedTable] = useState(null); // { id, table_number, area_name }
    const [selectedWaiter, setSelectedWaiter] = useState(() => {
        return waitersList.find(w => w.id === user.id) || waitersList[0] || user;
    });

    // Cart / Docket State
    // Items structure: { id, name, code, price, quantity, stationType, stationName, notes, isExistingItem: bool }
    const [cart, setCart] = useState([]);
    const [selectedCartItemId, setSelectedCartItemId] = useState(null);
    const [qtyDrafts, setQtyDrafts] = useState({});
    const qtySkipCommitRef = useRef(new Set());

    // Active Held Order Editing State (when adding products to a held order)
    const [editingOrder, setEditingOrder] = useState(null); // null or Order object
    const [orderEditMode, setOrderEditMode] = useState(false);

    // Orders History State
    const [recentOrders, setRecentOrders] = useState(initialOrders);

    // Modals & Dialogs
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successOrder, setSuccessOrder] = useState(null);
    const [showRetrieveModal, setShowRetrieveModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [orderToSettle, setOrderToSettle] = useState(null);
    const [settlePaymentMethod, setSettlePaymentMethod] = useState('cash'); // 'cash' | 'telebirr' | 'cbe_birr' | 'card' | 'room_charge'
    const [settleAmountTendered, setSettleAmountTendered] = useState('');
    const [printReceiptOnSettle, setPrintReceiptOnSettle] = useState(true);
    const [showExitModal, setShowExitModal] = useState(false);
    const [pendingConfirm, setPendingConfirm] = useState(null);
    const [itemNotesModal, setItemNotesModal] = useState(null); // { itemId, name, notes }
    const [toasts, setToasts] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    const theme = 'light';

    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', 'light');
    }, []);

    useEffect(() => {
        const frame = document.createElement('iframe');
        frame.id = 'irp200dPrintFrame';
        frame.setAttribute('style', 'position:absolute;width:0;height:0;border:none;visibility:hidden;');
        document.body.appendChild(frame);

        const printQueue = [];
        let printBusy = false;
        const printStyles = `
                @page { size: 80mm auto; margin: 0; }
                * { box-sizing: border-box; }
                body { width: 72mm; margin: 0 auto; padding: 3mm 0 8mm; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 12px; line-height: 1.25; color: #000; background: #fff; }
                .irp200d-ticket-header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
                .irp200d-title { font-size: 16px; font-weight: 800; margin: 0; }
                .irp200d-banner { font-size: 14px; font-weight: 900; border: 2px solid #000; padding: 3px 2px; margin: 4px 0; text-align: center; }
                .irp200d-meta-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; gap: 8px; }
                .irp200d-meta-line { font-size: 11px; margin: 2px 0; word-break: break-word; }
                .irp200d-items-table { width: 100%; border-collapse: collapse; margin: 2mm 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
                .irp200d-items-table th { font-size: 11px; text-transform: uppercase; border-bottom: 1px dashed #000; padding: 3px 0; text-align: left; }
                .irp200d-items-table th.irp200d-item-qty { text-align: right; }
                .irp200d-items-table th.irp200d-qty-start { text-align: left; }
                .irp200d-items-table td { padding: 3px 0; vertical-align: top; }
                .irp200d-item-name { font-size: 13px; font-weight: 700; text-align: left; padding-left: 8px; }
                .irp200d-item-qty { font-size: 15px; font-weight: 800; width: 42px; white-space: nowrap; text-align: right; }
                .irp200d-qty-start { width: 52px; white-space: nowrap; text-align: left; padding-right: 10px; font-size: 15px; font-weight: 800; }
                .irp200d-item-notes { font-size: 11px; font-style: italic; font-weight: 600; text-align: left; white-space: normal; word-break: break-word; }
                .irp200d-item-void { text-decoration: line-through; color: #000; background: transparent; }
                .irp200d-cutter-feed { height: 12mm; border-bottom: 1px dotted #888; margin-top: 4mm; text-align: center; font-size: 9px; }
        `;

        const drainPrintQueue = () => {
            if (printBusy || printQueue.length === 0) {
                return;
            }

            printBusy = true;
            const ticketContentHtml = printQueue.shift();
            const doc = frame.contentWindow?.document;
            if (!doc) {
                printBusy = false;
                return;
            }

            doc.open();
            doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>IRP 200D</title><style>${printStyles}</style></head><body>${ticketContentHtml}</body></html>`);
            doc.close();
            window.setTimeout(() => {
                frame.contentWindow?.focus();
                frame.contentWindow?.print();
                window.setTimeout(() => {
                    printBusy = false;
                    drainPrintQueue();
                }, 700);
            }, 250);
        };

        window.printIrp200dTicket = (ticketContentHtml) => {
            printQueue.push(ticketContentHtml);
            drainPrintQueue();
        };

        return () => {
            delete window.printIrp200dTicket;
            frame.remove();
        };
    }, []);

    // Responsive Mobile View Switcher ('content' | 'docket')
    const [mobileView, setMobileView] = useState('content');

    // Live Digital Clock & Date
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Floating Toast Notification Dispatcher
    const addToast = useCallback((title, message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 2600);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Flatten all tables across dining areas
    const allTablesList = useMemo(() => {
        const list = [];
        diningAreas.forEach(area => {
            if (area.tables && Array.isArray(area.tables)) {
                area.tables.forEach(tbl => {
                    list.push({
                        ...tbl,
                        area_name: area.name,
                        dining_area_id: area.id
                    });
                });
            }
        });
        return list;
    }, [diningAreas]);

    // Area filter for Table Seating Plan
    const [selectedAreaId, setSelectedAreaId] = useState('all');
    const [tableSearchFilter, setTableSearchFilter] = useState('');

    const filteredTablesList = useMemo(() => {
        let list = allTablesList;
        if (selectedAreaId !== 'all') {
            list = list.filter(t => t.dining_area_id === selectedAreaId);
        }
        if (tableSearchFilter.trim()) {
            const q = tableSearchFilter.trim().toLowerCase();
            list = list.filter(t => 
                String(t.table_number).toLowerCase().includes(q) ||
                (t.area_name && t.area_name.toLowerCase().includes(q))
            );
        }
        return list;
    }, [allTablesList, selectedAreaId, tableSearchFilter]);

    // Flattened menu items
    const allMenuItems = useMemo(() => {
        const items = [];
        categories.forEach(cat => {
            if (cat.menu_items && Array.isArray(cat.menu_items)) {
                cat.menu_items.forEach(item => {
                    items.push({
                        ...item,
                        category_id: cat.id,
                        category_name: cat.name
                    });
                });
            }
        });
        return items;
    }, [categories]);

    // Items for current category or search
    const displayedItems = useMemo(() => {
        if (activeTopTab === 'FAVORITE') {
            return allMenuItems.filter((item) => item.is_favorite);
        }
        if (activeTopTab === 'SEARCH' || searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            return allMenuItems.filter(it => 
                it.name.toLowerCase().includes(q) || 
                (it.code && it.code.toLowerCase().includes(q)) ||
                (it.category_name && it.category_name.toLowerCase().includes(q))
            );
        }
        if (selectedCategory) {
            return allMenuItems.filter(it => it.category_id === selectedCategory.id);
        }
        return [];
    }, [allMenuItems, activeTopTab, searchQuery, selectedCategory]);

    // Filtered Waiters List from HR Waiter Department
    const [waiterSearchQuery, setWaiterSearchQuery] = useState('');
    const filteredWaiters = useMemo(() => {
        if (!waiterSearchQuery.trim()) return waitersList;
        const q = waiterSearchQuery.toLowerCase().trim();
        return waitersList.filter(w => 
            w.name.toLowerCase().includes(q) || 
            (w.username && w.username.toLowerCase().includes(q))
        );
    }, [waitersList, waiterSearchQuery]);

    // Cart calculations (Grand Total in Ethiopian Birr)
    const cartTotals = useMemo(() => {
        const activeItems = cart.filter(item => !item.voided);
        const subtotal = roundMoney(activeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0));
        const chargeType = editingOrder?.order_type || orderType;
        const serviceCharge = chargeType === 'dine_in' ? roundMoney(subtotal * serviceChargeRate / 100) : 0;
        const vat = roundMoney((subtotal + serviceCharge) * vatRate / 100);
        const itemCount = activeItems.reduce((sum, item) => sum + item.quantity, 0);
        const newItemsCount = activeItems.filter(it => !it.isExistingItem).reduce((sum, it) => sum + it.quantity, 0);
        return {
            subtotal,
            serviceCharge,
            vat,
            grandTotal: roundMoney(subtotal + serviceCharge + vat),
            itemCount,
            newItemsCount
        };
    }, [cart, editingOrder, orderType, serviceChargeRate, vatRate]);

    // Add item to cart
    const addToCart = useCallback((item) => {
        playPosSound('add');
        const existing = cart.find(ci => {
            if (ci.voided) return false;
            if (orderEditMode) {
                return ci.menuItemId === item.id || ci.id === item.id;
            }
            return ci.id === item.id && !ci.isExistingItem;
        });

        if (existing) {
            setQtyDrafts(prev => {
                if (!(existing.id in prev)) return prev;
                const next = { ...prev };
                delete next[existing.id];
                return next;
            });
            setCart(prev => prev.map(ci => ci.id === existing.id ? { ...ci, quantity: Number(ci.quantity) + 1 } : ci));
            setSelectedCartItemId(existing.id);
            addToast(
                orderEditMode ? 'Quantity Updated' : 'Item Added',
                orderEditMode ? `${item.name} is already on this order. Count increased by 1.` : `${item.name} added to docket`,
                orderEditMode ? 'info' : 'success'
            );
            return;
        }

        const stationType = item.order_station ? item.order_station.station_type : (item.preparation_department || 'kitchen');
        const stationName = item.order_station ? item.order_station.name : (stationType === 'bar' ? 'Central Bar' : 'Main Kitchen');

        setCart(prev => {
            const line = {
                id: item.id,
                menuItemId: item.id,
                name: item.name,
                code: item.code,
                price: parseFloat(item.price),
                quantity: 1,
                stationType,
                stationName,
                notes: '',
                isExistingItem: false,
                voided: false
            };
            const active = prev.filter(ci => !ci.voided);
            const voided = prev.filter(ci => ci.voided);
            return [...active, line, ...voided];
        });
        setSelectedCartItemId(item.id);
        addToast('Item Added', `${item.name} added to docket`, 'success');
    }, [addToast, cart, orderEditMode]);

    const clearQtyDraft = useCallback((itemId) => {
        setQtyDrafts(prev => {
            if (!(itemId in prev)) return prev;
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    }, []);

    // Update quantity
    const updateQuantity = useCallback((itemId, delta) => {
        playPosSound('add');
        clearQtyDraft(itemId);
        setCart(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    if (item.voided) return item;
                    if (item.isExistingItem && !orderEditMode) {
                        addToast('Notice', 'Cannot modify quantity of already sent items. Add new line instead.', 'warning');
                        return item;
                    }
                    const newQty = item.quantity + delta;
                    if (item.isExistingItem && newQty <= 0) {
                        addToast('Use VOID', 'Use VOID to cancel a sent item. Quantity cannot go to zero.', 'warning');
                        return item;
                    }
                    return newQty > 0 ? { ...item, quantity: newQty } : null;
                }
                return item;
            }).filter(Boolean);
        });
        setSelectedCartItemId(itemId);
    }, [addToast, orderEditMode, clearQtyDraft]);

    const commitLineQuantity = useCallback((itemId, raw) => {
        if (qtySkipCommitRef.current.has(itemId)) {
            qtySkipCommitRef.current.delete(itemId);
            return;
        }

        const parsed = parseQtyInput(raw);
        clearQtyDraft(itemId);

        setCart(prev => {
            const current = prev.find(item => item.id === itemId);
            if (!current || current.voided) {
                return prev;
            }
            if (current.isExistingItem && !orderEditMode) {
                addToast('Notice', 'Cannot modify quantity of already sent items. Add new line instead.', 'warning');
                return prev;
            }
            if (!parsed.ok || parsed.value < 0) {
                addToast('Invalid quantity', 'Enter a number such as 0.5 or 2.', 'warning');
                return prev;
            }
            if (parsed.value < 0.01) {
                if (current.isExistingItem) {
                    addToast('Use VOID', 'Use VOID to cancel a sent item. Quantity cannot go to zero.', 'warning');
                    return prev;
                }
                playPosSound('void');
                const updated = prev.filter(item => item.id !== itemId);
                const active = updated.filter(item => !item.voided);
                setSelectedCartItemId(active.length > 0 ? active[active.length - 1].id : null);
                return updated;
            }
            if (parsed.value === roundQty(current.quantity)) {
                return prev;
            }
            playPosSound('add');
            return prev.map(item => item.id === itemId ? { ...item, quantity: parsed.value } : item);
        });
        setSelectedCartItemId(itemId);
    }, [addToast, orderEditMode, clearQtyDraft]);

    // VOID ACTION: Asks before removing the selected line.
    const voidSelectedItem = useCallback(() => {
        if (pendingConfirm) return;

        const activeItems = cart.filter(it => !it.voided);
        if (activeItems.length === 0) {
            addToast('Docket Empty', 'No items in order to void.', 'warning');
            return;
        }

        const selected = cart.find(it => it.id === selectedCartItemId);
        if (selected?.voided) {
            addToast('Already Voided', `${selected.name} is already voided.`, 'info');
            return;
        }

        const targetItem = selected || activeItems[activeItems.length - 1];

        if (!targetItem) {
            addToast('No Selection', 'Tap an item in the docket to void.', 'warning');
            return;
        }

        if (targetItem.isExistingItem && !orderEditMode) {
            addToast('Void Restricted', 'Item is already dispatched to kitchen/bar. Contact supervisor to cancel.', 'warning');
            return;
        }

        setPendingConfirm({ kind: 'void', itemId: targetItem.id, itemName: targetItem.name });
    }, [cart, selectedCartItemId, addToast, orderEditMode, pendingConfirm]);

    const confirmVoidItem = useCallback(() => {
        if (!pendingConfirm || pendingConfirm.kind !== 'void') return;

        const targetId = pendingConfirm.itemId;
        const itemName = pendingConfirm.itemName;
        playPosSound('void');
        setCart(prev => {
            const target = prev.find(it => it.id === targetId);
            if (target?.isExistingItem) {
                const next = prev.map(it => it.id === targetId ? { ...it, voided: true } : it);
                const active = next.filter(it => !it.voided);
                setSelectedCartItemId(active.length > 0 ? active[active.length - 1].id : null);
                return [...active, ...next.filter(it => it.voided)];
            }

            const updated = prev.filter(it => it.id !== targetId);
            const active = updated.filter(it => !it.voided);
            setSelectedCartItemId(active.length > 0 ? active[active.length - 1].id : null);
            return [...active, ...updated.filter(it => it.voided)];
        });
        setPendingConfirm(null);
        addToast('Item Voided', `${itemName} removed from docket`, 'danger');
    }, [pendingConfirm, addToast]);

    // Save notes for item
    const saveItemNotes = useCallback((itemId, notes) => {
        setCart(prev => prev.map(it => it.id === itemId ? { ...it, notes } : it));
        setItemNotesModal(null);
        addToast('Notes Saved', 'Kitchen / Bar prep notes saved', 'info');
    }, [addToast]);

    // Select Table Action
    const handleSelectTable = useCallback((table) => {
        // If table has an active order, prompt to retrieve/add products or settle
        if (table.active_order) {
            setSelectedReferenceOrder(table.active_order);
            setShowRetrieveModal(true);
            return;
        }

        setSelectedTable({
            id: table.id,
            table_number: table.table_number,
            area_name: table.area_name || ''
        });
        setOrderType('dine_in');
        addToast('Table Selected', `Table T-${table.table_number} assigned`, 'info');
        setRmsSubTab('WAITERS');
        setActiveTopTab('RMS');
    }, [addToast]);

    const openSettleModal = useCallback((order) => {
        if (!order) return;
        setOrderToSettle(order);
        setShowRetrieveModal(false);
        setShowSettleModal(true);
    }, []);

    // Select Waiter Action (From HR Waiter Department)
    const handleSelectWaiter = useCallback((waiter) => {
        setSelectedWaiter(waiter);
        addToast('Waiter Assigned', `Waiter: ${waiter.name}`, 'info');
        setActiveTopTab('CATEGORY');
    }, [addToast]);

    // RETRIEVE / LOAD HELD ORDER TO ADD PRODUCTS, OR OPEN IT FOR EDITING
    const handleLoadOrderToEdit = useCallback((order, editable = false) => {
        if (!order) return;
        setEditingOrder(order);
        setOrderEditMode(editable);

        // Prepopulate table
        if (order.table) {
            setSelectedTable({
                id: order.table.id,
                table_number: order.table.table_number,
                area_name: order.table.dining_area ? order.table.dining_area.name : ''
            });
        }

        // Prepopulate waiter
        if (order.waiter) {
            setSelectedWaiter(order.waiter);
        }

        // Prepopulate items from order as already sent/held
        const existingCartItems = (order.items || []).map(it => ({
            id: editable ? `line-${it.id}` : (it.menu_item_id || it.id),
            orderItemId: editable ? it.id : null,
            menuItemId: it.menu_item_id || it.menu_item?.id || null,
            name: it.name || (it.menu_item ? it.menu_item.name : 'Item'),
            code: it.menu_item?.code || '',
            price: parseFloat(it.unit_price),
            quantity: parseFloat(it.quantity),
            stationType: it.preparation_department || 'kitchen',
            stationName: it.preparation_department === 'bar' ? 'Central Bar' : 'Main Kitchen',
            notes: it.special_instructions || '',
            isExistingItem: true,
            voided: it.status === 'cancelled' || it.status === 'voided'
        })).sort((left, right) => Number(Boolean(left.voided)) - Number(Boolean(right.voided)));

        setCart(existingCartItems);
        setSelectedCartItemId(existingCartItems[0]?.id || null);
        setShowRetrieveModal(false);
        addToast(
            editable ? 'Editing Order' : 'Order Loaded',
            editable
                ? `Order #${order.order_number} is open. Change the items, add new ones, then save.`
                : `Order #${order.order_number} loaded. You can now add new products and hold again!`,
            'info'
        );
    }, [addToast]);

    // CANCEL EDITING HELD ORDER
    const handleCancelEditOrder = useCallback(() => {
        setEditingOrder(null);
        setOrderEditMode(false);
        setCart([]);
        setSelectedTable(null);
        setSelectedCartItemId(null);
        addToast('Edit Cancelled', 'Docket cleared and returned to fresh state', 'info');
    }, [addToast]);

    // SUBMIT ORDER OR ADD PRODUCTS TO HELD ORDER (IRP 200D Thermal Printer)
    const handleSubmitOrder = async () => {
        const activeCart = cart.filter(item => !item.voided);
        const savingEmptyEdit = Boolean(editingOrder && orderEditMode && activeCart.length === 0);
        if (activeCart.length === 0 && !savingEmptyEdit) {
            addToast('Empty Order', 'Please add items before dispatching order.', 'warning');
            return;
        }

        // MANDATORY 1: Dining Table
        if (!selectedTable) {
            addToast('Table Mandatory', 'Please select a dining table before dispatching.', 'warning');
            playPosSound('void');
            setActiveTopTab('RMS');
            setRmsSubTab('TABLE');
            return;
        }

        // MANDATORY 2: Waiter Assignment
        if (!selectedWaiter) {
            addToast('Waiter Mandatory', 'Please select an assigned waiter before dispatching.', 'warning');
            playPosSound('void');
            setActiveTopTab('RMS');
            setRmsSubTab('WAITERS');
            return;
        }

        setIsSubmitting(true);

        const readError = (data) => {
            const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
            return first || data?.message || 'Error updating order.';
        };

        // CASE A: Save changes to an existing order opened with Edit
        if (editingOrder && orderEditMode) {
            const payload = {
                waiter_id: selectedWaiter.id,
                restaurant_table_id: selectedTable.id,
                lines: activeCart.map(item => item.orderItemId ? ({
                    order_item_id: item.orderItemId,
                    quantity: item.quantity,
                    notes: item.notes || null
                }) : ({
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    notes: item.notes || null
                }))
            };

            try {
                const editUrl = `${routes.addItemsBase || '/pos/orders'}/${editingOrder.id}/edit`;
                const response = await fetch(editUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    addToast('Save Error', readError(data), 'danger');
                    setIsSubmitting(false);
                    return;
                }

                const updatedOrder = data.order;
                playPosSound('success');

                if (data.new_tickets && data.new_tickets.length > 0) {
                    data.new_tickets.forEach(ticket => {
                        const ticketHtml = buildIrp200dTicketHtml(updatedOrder, ticket, appName);
                        printIrp200d(ticketHtml);
                    });
                }

                setRecentOrders(prev => [updatedOrder, ...prev.filter(o => o.id !== updatedOrder.id)]);
                setEditingOrder(null);
                setOrderEditMode(false);
                setCart([]);
                setSelectedCartItemId(null);
                setSelectedTable(null);

                addToast('Order Updated', `Order #${updatedOrder.order_number} saved.`, 'success');
                setActiveTopTab('REFERENCE');
            } catch (err) {
                console.error('Editing order failed:', err);
                addToast('Server Error', 'Failed to communicate with server.', 'danger');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // CASE B: Adding new products to an existing held order!
        if (editingOrder) {
            const newItems = cart.filter(it => !it.isExistingItem);
            if (newItems.length === 0) {
                addToast('No New Items', 'Please select additional items to add to this held order.', 'warning');
                setIsSubmitting(false);
                return;
            }

            const payload = {
                items: newItems.map(item => ({
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    notes: item.notes || null,
                    modifiers: []
                }))
            };

            try {
                const addUrl = `${routes.addItemsBase || '/pos/orders'}/${editingOrder.id}/add-items`;
                const response = await fetch(addUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    addToast('Submission Error', data.message || 'Error updating order.', 'danger');
                    setIsSubmitting(false);
                    return;
                }

                const updatedOrder = data.order;
                playPosSound('success');

                // Print supplementary tickets on IRP 200D for newly added items
                if (data.new_tickets && data.new_tickets.length > 0) {
                    data.new_tickets.forEach(ticket => {
                        const ticketHtml = buildIrp200dTicketHtml(updatedOrder, ticket, appName);
                        printIrp200d(ticketHtml);
                    });
                }

                // Update recent orders list
                setRecentOrders(prev => [updatedOrder, ...prev.filter(o => o.id !== updatedOrder.id)]);

                // Reset editing state and clear cart
                setEditingOrder(null);
                setOrderEditMode(false);
                setCart([]);
                setSelectedCartItemId(null);
                setSelectedTable(null);

                addToast('Order Updated & Held', `New items dispatched to IRP 200D. Order #${updatedOrder.order_number} held on Table T-${updatedOrder.table?.table_number}!`, 'success');
                setRmsSubTab('TABLE');
                setActiveTopTab('RMS');

            } catch (err) {
                console.error('Adding items failed:', err);
                addToast('Server Error', 'Failed to communicate with server.', 'danger');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // CASE C: Creating a fresh order and holding on table
        const payload = {
            order_type: orderType,
            restaurant_table_id: selectedTable.id,
            waiter_id: selectedWaiter.id,
            customer_name: null,
            customer_phone: null,
            delivery_address: null,
            notes: null,
            items: activeCart.map(item => ({
                menu_item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                notes: item.notes || null,
                modifiers: []
            }))
        };

        try {
            const response = await fetch(routes.storeOrder || '/pos/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                addToast('Submission Error', data.message || 'Error creating order.', 'danger');
                setIsSubmitting(false);
                return;
            }

            const newOrder = data.order;
            playPosSound('success');

            // Trigger ESC/POS 80mm Print on IRP 200D for each station ticket
            if (newOrder.tickets && newOrder.tickets.length > 0) {
                newOrder.tickets.forEach(ticket => {
                    const ticketHtml = buildIrp200dTicketHtml(newOrder, ticket, appName);
                    printIrp200d(ticketHtml);
                });
            }

            // Update recent orders list
            setRecentOrders(prev => [newOrder, ...prev]);

            // Show confirmation modal
            setSuccessOrder(newOrder);
            addToast('Order Held', `Order #${newOrder.order_number} held on Table T-${selectedTable.table_number}`, 'success');

            // Reset current cart and clear table
            setCart([]);
            setSelectedCartItemId(null);
            allTablesList.forEach(t => {
                if (t.id === selectedTable.id) {
                    t.status = 'occupied';
                    t.active_order = newOrder;
                }
            });
            setSelectedTable(null);

            setSelectedReferenceOrder(newOrder);
            setActiveTopTab('REFERENCE');

        } catch (err) {
            console.error('Order submission failed:', err);
            addToast('Server Error', 'Failed to communicate with server.', 'danger');
        } finally {
            setIsSubmitting(false);
        }
    };

    // SETTLE / PAY ORDER IN ETHIOPIAN BIRR (ETB)
    const handleConfirmSettleOrder = async () => {
        if (!orderToSettle) return;
        setIsSubmitting(true);

        const totalDue = parseFloat(orderToSettle.total_amount || 0);
        const tenderedVal = settleAmountTendered ? parseFloat(settleAmountTendered) : totalDue;

        try {
            const settleUrl = `${routes.settleBase || '/pos/orders'}/${orderToSettle.id}/settle`;
            const response = await fetch(settleUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({
                    payment_method: settlePaymentMethod,
                    amount_tendered: tenderedVal
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                addToast('Settlement Error', data.message || 'Error settling order.', 'danger');
                setIsSubmitting(false);
                return;
            }

            const settled = data.order;
            playPosSound('success');

            // Optionally print settlement receipt to IRP 200D
            if (printReceiptOnSettle) {
                const receiptHtml = buildIrp200dSettlementReceiptHtml(settled, settlePaymentMethod, tenderedVal, appName);
                printIrp200d(receiptHtml);
            }

            // Update recent orders list
            setRecentOrders(prev => prev.map(o => o.id === settled.id ? settled : o));

            // Free the table
            if (settled.restaurant_table_id) {
                allTablesList.forEach(t => {
                    if (t.id === settled.restaurant_table_id) {
                        t.status = 'available';
                        t.active_order = null;
                    }
                });
            }

            setShowSettleModal(false);
            setOrderToSettle(null);
            setShowRetrieveModal(false);
            setSettleAmountTendered('');

            addToast('Settled & Paid', `Order #${settled.order_number} marked as Paid. Table freed!`, 'success');

        } catch (err) {
            console.error('Settlement error:', err);
            addToast('Server Error', 'Failed to settle order on server.', 'danger');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Keyboard Shortcuts (F6 = Send/Hold Order, F7 = Void Selected Item)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F6') {
                e.preventDefault();
                handleSubmitOrder();
            } else if (e.key === 'F7') {
                e.preventDefault();
                voidSelectedItem();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSubmitOrder, voidSelectedItem]);

    const filteredOrders = recentOrders;

    // Format time and date matching reference layout
    const clockTimeStr = currentTime.toLocaleTimeString('en-US', { hour12: false });
    const clockDateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <div className={`pos-container pos-theme-${theme} d-flex flex-column vh-100 w-100 overflow-hidden position-relative`}>
            {/* Smart Animated Ambient Background Effect */}
            <div className="smart-animated-bg">
                <div className="smart-blob smart-blob-1"></div>
                <div className="smart-blob smart-blob-2"></div>
                <div className="smart-blob smart-blob-3"></div>
            </div>

            <style>{`
                .pos-container {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
                    letter-spacing: -0.011em;
                    position: relative;
                }
                .pos-theme-light {
                    background-color: #f1f5f9;
                    color: #0f172a;
                }
                .pos-theme-dark {
                    background-color: #0b1120;
                    color: #f1f5f9;
                }

                /* Smart Animated Ambient Background */
                .smart-animated-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                    overflow: hidden;
                }
                .pos-theme-light .smart-animated-bg {
                    opacity: 0.70;
                }
                .pos-theme-dark .smart-animated-bg {
                    opacity: 0.40;
                }
                .smart-blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    will-change: transform;
                }
                .smart-blob-1 {
                    top: -10%;
                    right: 5%;
                    width: 460px;
                    height: 460px;
                    background: radial-gradient(circle, rgba(217, 119, 6, 0.22) 0%, rgba(217, 119, 6, 0) 70%);
                    animation: smartFloat1 18s ease-in-out infinite alternate;
                }
                .smart-blob-2 {
                    bottom: -15%;
                    left: 10%;
                    width: 560px;
                    height: 560px;
                    background: radial-gradient(circle, rgba(37, 99, 235, 0.20) 0%, rgba(37, 99, 235, 0) 70%);
                    animation: smartFloat2 22s ease-in-out infinite alternate;
                }
                .smart-blob-3 {
                    top: 40%;
                    right: 30%;
                    width: 420px;
                    height: 420px;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0) 70%);
                    animation: smartFloat3 26s ease-in-out infinite alternate;
                }
                @keyframes smartFloat1 {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-45px, 65px) scale(1.08); }
                    100% { transform: translate(35px, -35px) scale(0.95); }
                }
                @keyframes smartFloat2 {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(65px, -55px) scale(1.06); }
                    100% { transform: translate(-35px, 45px) scale(0.92); }
                }
                @keyframes smartFloat3 {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-55px, -45px) scale(1.12); }
                    100% { transform: translate(45px, 35px) scale(0.96); }
                }

                /* Header Bar */
                .pos-theme-light .pos-header-bar {
                    background-color: #ffffff;
                    border-bottom: 1px solid #e2e8f0;
                }
                .pos-theme-dark .pos-header-bar {
                    background-color: #111c30;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .pos-header-box {
                    min-height: 52px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    padding: 4px 12px;
                    font-weight: 600;
                    position: relative;
                    z-index: 1;
                }
                .pos-theme-light .pos-header-box {
                    background-color: #ffffff;
                    border-color: #e2e8f0 !important;
                    color: #0f172a;
                }
                .pos-theme-dark .pos-header-box {
                    background-color: #111c30;
                    border-color: rgba(255, 255, 255, 0.1) !important;
                    color: #f1f5f9;
                }

                /* Nav Tab Buttons */
                .pos-nav-tab-btn {
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    transition: all 0.15s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 0 14px;
                    position: relative;
                    z-index: 1;
                }
                .pos-theme-light .pos-nav-tab-btn {
                    background-color: #f8fafc;
                    border: 1px solid #cbd5e1;
                    color: #334155;
                }
                .pos-theme-light .pos-nav-tab-btn:hover {
                    background-color: #e2e8f0;
                    color: #0f172a;
                }
                .pos-theme-light .pos-nav-tab-btn.active {
                    background-color: #0284c7 !important;
                    color: #ffffff !important;
                    border-color: #0284c7 !important;
                    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
                }
                .pos-theme-dark .pos-nav-tab-btn {
                    background-color: #16243d;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                }
                .pos-theme-dark .pos-nav-tab-btn:hover {
                    background-color: #1e3a5f;
                    color: #ffffff;
                }
                .pos-theme-dark .pos-nav-tab-btn.active {
                    background-color: #0284c7 !important;
                    color: #ffffff !important;
                    border-color: #0284c7 !important;
                    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.5);
                }

                /* Subnav buttons */
                .pos-subnav-btn {
                    font-weight: 700;
                    padding: 8px 18px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .pos-theme-light .pos-subnav-btn {
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    color: #334155;
                }
                .pos-theme-light .pos-subnav-btn:hover {
                    background-color: #e2e8f0;
                    color: #0f172a;
                }
                .pos-theme-light .pos-subnav-btn.active {
                    background-color: #0284c7 !important;
                    color: #ffffff !important;
                    border-color: #0284c7 !important;
                }
                .pos-theme-dark .pos-subnav-btn {
                    background-color: #16243d;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #cbd5e1;
                }
                .pos-theme-dark .pos-subnav-btn:hover {
                    background-color: #1e3a5f;
                    color: #ffffff;
                }
                .pos-theme-dark .pos-subnav-btn.active {
                    background-color: #0284c7 !important;
                    color: #ffffff !important;
                    border-color: #0284c7 !important;
                }

                /* Docket Pane */
                .pos-docket-pane {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    position: relative;
                    z-index: 1;
                }
                .pos-theme-light .pos-docket-pane {
                    background-color: #ffffff;
                    border-right: 2px solid #e2e8f0;
                }
                .pos-theme-dark .pos-docket-pane {
                    background-color: #111c30;
                    border-right: 2px solid rgba(255, 255, 255, 0.08);
                }
                .pos-assign-chip,
                .pos-assign-chip:hover,
                .pos-assign-chip:focus,
                .pos-assign-chip:active {
                    background-color: #ffffff !important;
                    font-weight: 700;
                }
                .pos-assign-chip-table,
                .pos-assign-chip-table:hover,
                .pos-assign-chip-table:focus,
                .pos-assign-chip-table:active {
                    color: #0d6efd !important;
                    border-color: #0d6efd !important;
                }
                .pos-assign-chip-waiter,
                .pos-assign-chip-waiter:hover,
                .pos-assign-chip-waiter:focus,
                .pos-assign-chip-waiter:active {
                    color: #212529 !important;
                    border-color: #212529 !important;
                }
                .pos-assign-chip-waiter .bi {
                    color: #0d6efd !important;
                }

                /* Docket Table */
                .pos-docket-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .pos-theme-light .pos-docket-table {
                    color: #0f172a;
                }
                .pos-theme-light .pos-docket-table th {
                    background-color: #f8fafc;
                    color: #475569;
                    padding: 9px 10px;
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: uppercase;
                    border-bottom: 2px solid #cbd5e1;
                }
                .pos-theme-light .pos-docket-table td {
                    padding: 9px 10px;
                    font-size: 13.5px;
                    border-bottom: 1px solid #f1f5f9;
                    cursor: pointer;
                }
                .pos-theme-light .pos-docket-row:hover {
                    background-color: #f8fafc;
                }
                .pos-theme-light .pos-docket-row.selected {
                    background-color: #e0f2fe !important;
                    color: #0369a1 !important;
                    border-left: 4px solid #0284c7;
                }
                .pos-voided-row td {
                    background-color: #fee2e2 !important;
                    color: #991b1b !important;
                    text-decoration: line-through;
                }
                .pos-bill-head {
                    text-align: center;
                    padding: 12px 12px 8px;
                    border-bottom: 2px dashed #94a3b8;
                }
                .pos-bill-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 3px 12px;
                    font-size: 12px;
                }
                .pos-bill-totals {
                    margin: 0 12px 8px;
                    padding-top: 8px;
                    border-top: 2px dashed #94a3b8;
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    font-size: 13px;
                    flex-shrink: 0;
                }
                .pos-bill-totals div {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 2px 0;
                }
                .pos-bill-totals .total {
                    margin-top: 4px;
                    padding-top: 6px;
                    border-top: 1px solid #0f172a;
                    font-size: 15px;
                    font-weight: 800;
                }

                .pos-theme-dark .pos-docket-table {
                    color: #f1f5f9;
                }
                .pos-theme-dark .pos-docket-table th {
                    background-color: #16243d;
                    color: #94a3b8;
                    padding: 9px 10px;
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: uppercase;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
                }
                .pos-theme-dark .pos-docket-table td {
                    padding: 9px 10px;
                    font-size: 13.5px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                    cursor: pointer;
                }
                .pos-theme-dark .pos-docket-row:hover {
                    background-color: #16243d;
                }
                .pos-theme-dark .pos-docket-row.selected {
                    background-color: #1e3a5f !important;
                    color: #38bdf8 !important;
                    border-left: 4px solid #38bdf8;
                }

                /* Category Tiles */
                .pos-category-tile {
                    border-radius: 8px;
                    min-height: 120px;
                    cursor: pointer;
                    transition: all 0.18s ease;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .pos-theme-light .pos-category-tile {
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .pos-theme-light .pos-category-tile:hover {
                    border-color: #0284c7;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(2,132,199,0.15);
                }
                .pos-theme-light .pos-category-tile-header {
                    background-color: #f8fafc;
                    font-size: 11.5px;
                    color: #0284c7;
                    font-weight: 700;
                    padding: 5px 8px;
                    text-align: right;
                    border-bottom: 1px solid #e2e8f0;
                }
                .pos-theme-light .pos-category-tile-body {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px;
                    text-align: center;
                    font-size: 17px;
                    font-weight: 800;
                    color: #0f172a;
                }

                .pos-theme-dark .pos-category-tile {
                    background-color: #111c30;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                }
                .pos-theme-dark .pos-category-tile:hover {
                    border-color: #38bdf8;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(56,189,248,0.2);
                }
                .pos-theme-dark .pos-category-tile-header {
                    background-color: #16243d;
                    font-size: 11.5px;
                    color: #38bdf8;
                    font-weight: 700;
                    padding: 5px 8px;
                    text-align: right;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }
                .pos-theme-dark .pos-category-tile-body {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px;
                    text-align: center;
                    font-size: 17px;
                    font-weight: 800;
                    color: #f8fafc;
                }

                /* Item Tiles */
                .pos-item-tile {
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 100px;
                }
                .pos-theme-light .pos-item-tile {
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    color: #0f172a;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
                }
                .pos-theme-light .pos-item-tile:hover {
                    border-color: #0284c7;
                    background-color: #f0f9ff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(2,132,199,0.12);
                }
                .pos-theme-dark .pos-item-tile {
                    background-color: #111c30;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #f8fafc;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .pos-theme-dark .pos-item-tile:hover {
                    border-color: #38bdf8;
                    background-color: #16243d;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(56,189,248,0.18);
                }

                /* Buttons */
                .pos-btn-void {
                    background-color: #dc2626;
                    color: #ffffff;
                    border: 1px solid #b91c1c;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .pos-btn-void:hover {
                    background-color: #b91c1c;
                }
                .pos-btn-order {
                    background-color: #16a34a;
                    color: #ffffff;
                    border: 1px solid #15803d;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .pos-btn-order:hover {
                    background-color: #15803d;
                }
                .pos-btn-total {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-weight: 800;
                }
                .pos-theme-light .pos-btn-total {
                    background-color: #0f172a;
                    border: 1px solid #1e293b;
                    color: #ffffff;
                }
                .pos-theme-dark .pos-btn-total {
                    background-color: #020617;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #ffffff;
                }

                /* Reference Table */
                .pos-ref-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .pos-theme-light .pos-ref-table {
                    color: #0f172a;
                }
                .pos-theme-light .pos-ref-table th {
                    background-color: #f1f5f9;
                    color: #334155;
                    padding: 9px 10px;
                    border: 1px solid #cbd5e1;
                    text-align: left;
                    font-weight: 800;
                }
                .pos-theme-light .pos-ref-table td {
                    padding: 9px 10px;
                    border: 1px solid #e2e8f0;
                    background-color: #ffffff;
                }
                .pos-theme-light .pos-ref-row:hover td {
                    background-color: #f0f9ff;
                }
                .pos-theme-light .pos-ref-row.selected td {
                    background-color: #e0f2fe;
                    color: #0369a1;
                    font-weight: 600;
                }

                .pos-theme-dark .pos-ref-table {
                    color: #f8fafc;
                }
                .pos-theme-dark .pos-ref-table th {
                    background-color: #16243d;
                    color: #94a3b8;
                    padding: 9px 10px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: left;
                    font-weight: 800;
                }
                .pos-theme-dark .pos-ref-table td {
                    padding: 9px 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background-color: #111c30;
                    color: #f1f5f9;
                }
                .pos-theme-dark .pos-ref-row:hover td {
                    background-color: #1a2a46;
                }
                .pos-theme-dark .pos-ref-row.selected td {
                    background-color: #1e3a5f;
                    color: #38bdf8;
                    font-weight: 600;
                }

                /* Bottom Bar Buttons */
                .pos-bottom-bar-btn {
                    font-weight: 700;
                    padding: 9px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    letter-spacing: 0.5px;
                    transition: all 0.15s;
                }
                .pos-theme-light .pos-bottom-bar-btn {
                    background-color: #ffffff;
                    border: 1px solid #cbd5e1;
                    color: #1e293b;
                }
                .pos-theme-light .pos-bottom-bar-btn:hover {
                    background-color: #f1f5f9;
                    border-color: #94a3b8;
                    color: #0f172a;
                }
                .pos-theme-dark .pos-bottom-bar-btn {
                    background-color: #16243d;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #f1f5f9;
                }
                .pos-theme-dark .pos-bottom-bar-btn:hover {
                    background-color: #1e3a5f;
                    border-color: #38bdf8;
                    color: #ffffff;
                }
            `}</style>

            {/* 1. TOP HEADER (Exact 1:1 Layout from Reference Screenshots in Light Theme) */}
            <header className="row g-0 border-bottom shrink-0 shadow-2xs pos-header-bar" style={{ minHeight: '54px' }}>
                {/* Box 1: App / Branch Name */}
                <div className="col-4 col-sm-3 col-md-2 pos-header-box border-end">
                    <div className="d-flex align-items-center gap-2 w-100 min-w-0">
                        <div className="d-flex align-items-center justify-content-center rounded-circle shrink-0" style={{ width: '28px', height: '28px', background: '#f26b1d', color: '#fff' }}>
                            <AppLogoIcon className="fill-current" style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div className="min-w-0">
                            <div className="lh-sm text-truncate w-100 fw-bold" style={{ fontSize: '13px' }}>{appName}</div>
                            <div className="text-primary text-truncate w-100 small fw-bold">({branch.name})</div>
                        </div>
                    </div>
                </div>

                {/* Box 2: Staff / Waiter Name (from HR Waiter Department) */}
                <div className="col-4 col-sm-3 col-md-2 pos-header-box border-end">
                    <div className="small text-muted text-uppercase" style={{ fontSize: '10px' }}>Staff / Waiter</div>
                    <div className="text-truncate w-100 fw-bold">
                        {selectedWaiter ? selectedWaiter.name : (user.name || 'Admin')}
                    </div>
                </div>

                {/* Box 3: Real-Time Clock & Date */}
                <div className="col-4 col-sm-2 col-md-2 pos-header-box border-end font-mono">
                    <div className="fw-bolder fs-6 text-primary lh-1 mb-0.5">{clockTimeStr}</div>
                    <div className="text-muted small" style={{ fontSize: '10px' }}>{clockDateStr}</div>
                </div>

                {/* Box 4: Navigation Tabs (RMS | CATEGORY | REFERENCE | FAVORITE | SEARCH | EXIT) */}
                <div ref={tabRowRef} className="col-12 col-sm-4 col-md-6 d-flex align-items-stretch overflow-x-auto text-nowrap flex-nowrap">
                    <button
                        ref={rmsTabRef}
                        type="button"
                        onClick={() => setActiveTopTab('RMS')}
                        className={`flex-fill pos-nav-tab-btn ${activeTopTab === 'RMS' ? 'active' : ''}`}
                    >
                        RMS
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTopTab('CATEGORY'); setSelectedCategory(null); }}
                        className={`flex-fill pos-nav-tab-btn ${activeTopTab === 'CATEGORY' ? 'active' : ''}`}
                    >
                        CATEGORY
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTopTab('REFERENCE')}
                        className={`flex-fill pos-nav-tab-btn ${activeTopTab === 'REFERENCE' ? 'active' : ''}`}
                    >
                        REFERENCE
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTopTab('FAVORITE')}
                        className={`flex-fill pos-nav-tab-btn ${activeTopTab === 'FAVORITE' ? 'active' : ''}`}
                    >
                        FAVORITE
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTopTab('SEARCH')}
                        className={`flex-fill pos-nav-tab-btn ${activeTopTab === 'SEARCH' ? 'active' : ''}`}
                    >
                        SEARCH
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowExitModal(true)}
                        className="flex-fill pos-nav-tab-btn text-danger fw-bold"
                    >
                        EXIT
                    </button>
                </div>
            </header>

            {/* TABLE and WAITERS sit on the right, directly under the RMS tab */}
            {activeTopTab === 'RMS' && (
                <div className={`row g-0 border-bottom shrink-0 shadow-2xs ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
                    <div className="d-none d-md-block col-md-2" />
                    <div className="d-none d-md-block col-md-2" />
                    <div className="d-none d-md-block col-md-2" />
                    <div className="col-12 col-md-6 d-flex align-items-center">
                        <div className="d-none d-md-block flex-shrink-0" style={{ width: rmsTabOffset }} />
                        <div className="d-flex align-items-center gap-1 py-2 pe-2 ps-2 ps-md-0 overflow-x-auto ms-auto ms-md-0">
                            <button
                                type="button"
                                onClick={() => setRmsSubTab('TABLE')}
                                className={`pos-subnav-btn rounded-1 ${rmsSubTab === 'TABLE' ? 'active' : ''}`}
                            >
                                <i className="bi bi-grid-3x3 me-1.5"></i>
                                TABLE {selectedTable ? `(T-${selectedTable.table_number})` : '*'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setRmsSubTab('WAITERS')}
                                className={`pos-subnav-btn rounded-1 ${rmsSubTab === 'WAITERS' ? 'active' : ''}`}
                            >
                                <i className="bi bi-person-badge me-1.5"></i>
                                WAITERS {selectedWaiter ? `(${selectedWaiter.name.split(' ')[0]})` : '*'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile View Toggle Bar (Only visible on small viewports) */}
            <div className={`d-flex d-md-none border-bottom p-1.5 gap-1 shrink-0 ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
                <button
                    type="button"
                    onClick={() => setMobileView('content')}
                    className={`btn btn-sm flex-fill fw-bold ${mobileView === 'content' ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                    <i className="bi bi-grid-fill me-1"></i> Screen
                </button>
                <button
                    type="button"
                    onClick={() => setMobileView('docket')}
                    className={`btn btn-sm flex-fill fw-bold ${mobileView === 'docket' ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                    <i className="bi bi-receipt me-1"></i> Docket ({cartTotals.itemCount}) - ETB {cartTotals.grandTotal.toFixed(2)}
                </button>
            </div>

            {/* 2. MAIN SPLIT SCREEN (Left: Docket / Right: Main Content) */}
            <div className="flex-grow-1 d-flex overflow-hidden">
                {/* LEFT COLUMN: THE ORDER DOCKET */}
                <div 
                    className={`pos-docket-pane ${mobileView === 'content' ? 'd-none d-md-flex' : 'd-flex w-100'}`} 
                    style={{ width: '390px', minWidth: '320px', maxWidth: '420px' }}
                >
                    {/* Editing Held Order Warning Banner */}
                    {editingOrder && (
                        <div className="p-2 bg-warning bg-opacity-25 border-bottom border-warning d-flex align-items-center justify-content-between">
                            <div>
                                <strong className="text-dark small d-block">{orderEditMode ? 'EDITING ORDER' : 'ADDING ITEMS TO HELD ORDER'}</strong>
                                <span className="text-muted font-mono" style={{ fontSize: '11px' }}>
                                    #{editingOrder.order_number} &bull; T-{editingOrder.table?.table_number}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPendingConfirm({ kind: 'cancel-edit' })}
                                className="btn btn-xs btn-outline-danger py-0 px-2 fw-bold"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Mandatory Table & Waiter Status Pill */}
                    <div className={`p-2 border-bottom d-flex align-items-center justify-content-between gap-1.5 ${theme === 'dark' ? 'bg-dark' : 'bg-light'}`}>
                        <button
                            type="button"
                            onClick={() => { setActiveTopTab('RMS'); setRmsSubTab('TABLE'); }}
                            className={`btn btn-xs py-1 px-2.5 text-start rounded-2 flex-fill ${
                                selectedTable ? 'pos-assign-chip pos-assign-chip-table' : 'btn-danger text-white fw-bold animate-pulse'
                            }`}
                            title="Click to select table (Mandatory)"
                        >
                            <i className="bi bi-grid-3x3 me-1"></i>
                            {selectedTable ? `T-${selectedTable.table_number}` : 'Table * (Select)'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveTopTab('RMS'); setRmsSubTab('WAITERS'); }}
                            className={`btn btn-xs py-1 px-2.5 text-start rounded-2 flex-fill ${
                                selectedWaiter ? 'pos-assign-chip pos-assign-chip-waiter' : 'btn-danger text-white fw-bold animate-pulse'
                            }`}
                            title="Click to assign waiter (Mandatory)"
                        >
                            <i className="bi bi-person-fill text-primary me-1"></i>
                            {selectedWaiter ? selectedWaiter.name.split(' ')[0] : 'Waiter * (Select)'}
                        </button>
                    </div>

                    {/* Docket Table Header & Items List */}
                    <div className="flex-grow-1 overflow-y-auto">
                        <div className="pos-bill-head">
                            <div className="fw-bold text-uppercase">{appName}</div>
                            <div className="small text-muted">Bill</div>
                        </div>
                        <div className="pos-bill-meta">
                            <span>Order</span>
                            <strong className="font-mono">{editingOrder ? `#${editingOrder.order_number}` : 'New order'}</strong>
                        </div>
                        <div className="pos-bill-meta">
                            <span>Table</span>
                            <strong>{selectedTable ? `T-${selectedTable.table_number}` : 'Not selected'}</strong>
                        </div>
                        <div className="pos-bill-meta">
                            <span>Waiter</span>
                            <strong>{selectedWaiter ? selectedWaiter.name : 'Not selected'}</strong>
                        </div>
                        <div className="pos-bill-meta">
                            <span>Time</span>
                            <strong className="font-mono">{currentTime.toLocaleString()}</strong>
                        </div>
                        <table className="pos-docket-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '45%' }}>Item</th>
                                    <th className="text-center" style={{ width: '15%' }}>Qty</th>
                                    <th className="text-end" style={{ width: '20%' }}>UPrice</th>
                                    <th className="text-end" style={{ width: '20%' }}>TPrice</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5 text-muted">
                                            <i className="bi bi-cart3 fs-1 d-block mb-2 opacity-30"></i>
                                            <div className="fw-semibold">Docket is empty</div>
                                            <small className="text-secondary">Select items from Category to build order</small>
                                        </td>
                                    </tr>
                                ) : (
                                    cart.map(item => {
                                        const isSelected = selectedCartItemId === item.id;
                                        return (
                                            <tr 
                                                key={item.id} 
                                                className={`pos-docket-row ${item.voided ? 'pos-voided-row' : ''} ${isSelected && !item.voided ? 'selected' : ''}`}
                                                onClick={() => setSelectedCartItemId(item.id)}
                                            >
                                                <td>
                                                    <div className="d-flex align-items-center gap-1">
                                                        {item.voided ? (
                                                            <span className="badge bg-danger bg-opacity-25 text-danger font-mono" style={{ fontSize: '9px', textDecoration: 'none' }}>
                                                                VOID
                                                            </span>
                                                        ) : item.isExistingItem ? (
                                                            <span className="badge bg-secondary bg-opacity-25 text-dark font-mono" style={{ fontSize: '9px' }}>
                                                                HELD
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-success bg-opacity-25 text-success font-mono" style={{ fontSize: '9px' }}>
                                                                NEW
                                                            </span>
                                                        )}
                                                        <div className="fw-bold text-truncate" style={{ maxWidth: '130px' }}>
                                                            {item.name}
                                                        </div>
                                                    </div>
                                                    {item.notes && (
                                                        <div className="text-danger small fst-italic" style={{ fontSize: '11px' }}>
                                                            * {item.notes}
                                                        </div>
                                                    )}
                                                    {isSelected && !item.voided && (!item.isExistingItem || orderEditMode) && (
                                                        <div className="mt-1 d-flex gap-1">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                                                className="btn btn-xs btn-outline-secondary py-0 px-1.5"
                                                            >
                                                                -
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                                                className="btn btn-xs btn-outline-secondary py-0 px-1.5"
                                                            >
                                                                +
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setItemNotesModal(item); }}
                                                                className="btn btn-xs btn-outline-warning py-0 px-1.5"
                                                                title="Add kitchen note"
                                                            >
                                                                <i className="bi bi-pencil-fill"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    {item.voided || (item.isExistingItem && !orderEditMode) ? (
                                                        <span className="font-mono fw-bold">{item.quantity}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            aria-label={`${item.name} quantity`}
                                                            className="form-control form-control-sm text-center font-mono fw-bold px-1 py-0"
                                                            style={{ width: '64px', margin: '0 auto', height: '28px' }}
                                                            value={qtyDrafts[item.id] ?? String(item.quantity)}
                                                            onChange={(e) => setQtyDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                            onFocus={(e) => {
                                                                setSelectedCartItemId(item.id);
                                                                setQtyDrafts(prev => ({ ...prev, [item.id]: prev[item.id] ?? String(item.quantity) }));
                                                                e.target.select();
                                                            }}
                                                            onBlur={(e) => commitLineQuantity(item.id, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                e.stopPropagation();
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.currentTarget.blur();
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    qtySkipCommitRef.current.add(item.id);
                                                                    clearQtyDraft(item.id);
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                </td>
                                                <td className="text-end font-mono">{item.price.toFixed(2)}</td>
                                                <td className="text-end font-mono fw-bold">{(item.price * item.quantity).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pos-bill-totals">
                        <div><span>Subtotal</span><span>{cartTotals.subtotal.toFixed(2)}</span></div>
                        <div><span>Service charge</span><span>{cartTotals.serviceCharge.toFixed(2)}</span></div>
                        <div><span>VAT</span><span>{cartTotals.vat.toFixed(2)}</span></div>
                        <div className="total"><span>Total</span><span>{cartTotals.grandTotal.toFixed(2)}</span></div>
                    </div>

                    {/* Docket Bottom Action Bar: VOID (F7) | ORDER / HOLD (F6) | TOTAL (ETB) - Permission Guarded */}
                    <div className="row g-0 border-top shrink-0" style={{ height: '66px' }}>
                        {/* VOID (F7) */}
                        {can('pos.orders.cancel') && (
                            <div className={can('pos.orders.create') ? "col-4 d-flex" : "col-6 d-flex"}>
                                <button
                                    type="button"
                                    onClick={voidSelectedItem}
                                    className="pos-btn-void w-100 h-100 d-flex flex-column align-items-center justify-content-center p-1"
                                    title="Void selected line item (F7)"
                                >
                                    <span className="fs-6 fw-bold">VOID</span>
                                    <small className="opacity-90 font-mono" style={{ fontSize: '10px' }}>(F7)</small>
                                </button>
                            </div>
                        )}

                        {/* ORDER / HOLD (F6) */}
                        {can('pos.orders.create') && (
                            <div className={can('pos.orders.cancel') ? "col-4 d-flex" : "col-6 d-flex"}>
                                <button
                                    type="button"
                                    onClick={handleSubmitOrder}
                                    disabled={isSubmitting}
                                    className="pos-btn-order w-100 h-100 d-flex flex-column align-items-center justify-content-center p-1"
                                    title="Send / Hold order and print tickets to IRP 200D (F6)"
                                >
                                    <span className="fs-6 fw-bold">
                                        {isSubmitting ? 'HOLDING...' : (orderEditMode ? 'SAVE EDIT' : (editingOrder ? 'ADD & HOLD' : 'ORDER / HOLD'))}
                                    </span>
                                    <small className="opacity-90 font-mono" style={{ fontSize: '10px' }}>(F6)</small>
                                </button>
                            </div>
                        )}

                        {/* TOTAL (IN ETHIOPIAN BIRR) */}
                        <div className={(!can('pos.orders.cancel') && !can('pos.orders.create')) ? "col-12 pos-btn-total p-1" : ((!can('pos.orders.cancel') || !can('pos.orders.create')) ? "col-6 pos-btn-total p-1" : "col-4 pos-btn-total p-1")}>
                            <span className="small text-warning text-uppercase" style={{ fontSize: '10px', letterSpacing: '1px' }}>TOTAL (BIRR)</span>
                            <span className="fs-5 font-mono text-white fw-bolder">
                                ETB {cartTotals.grandTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: MAIN CONTENT SCREEN (Light Theme) */}
                <div 
                    className={`flex-grow-1 d-flex flex-column overflow-hidden ${mobileView === 'docket' ? 'd-none d-md-flex' : 'd-flex'}`}
                    style={{ backgroundColor: theme === 'dark' ? 'transparent' : '#f8fafc' }}
                >
                    {/* A. CATEGORY VIEW (Photo 1 Style) */}
                    {activeTopTab === 'CATEGORY' && (
                        <div className="flex-grow-1 d-flex flex-column p-3 overflow-y-auto">
                            {!selectedCategory ? (
                                <>
                                    {/* Category Tiles Grid */}
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="fs-5 fw-bold text-dark">Menu Categories</div>
                                        <div className="text-muted small fw-semibold">{categories.length} Categories Available</div>
                                    </div>

                                    <div className="row g-3">
                                        {categories.map(cat => {
                                            const itemCount = cat.menu_items ? cat.menu_items.length : 0;
                                            return (
                                                <div key={cat.id} className="col-6 col-sm-4 col-lg-3 col-xl-2">
                                                    <div 
                                                        className="pos-category-tile shadow-2xs h-100"
                                                        onClick={() => setSelectedCategory(cat)}
                                                    >
                                                        <div className="pos-category-tile-header font-mono">
                                                            Sub Categories:{itemCount}
                                                        </div>
                                                        <div className="pos-category-tile-body">
                                                            {cat.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Drilled-down Category Items View */}
                                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCategory(null)}
                                                className="btn btn-sm btn-outline-primary fw-bold"
                                            >
                                                <i className="bi bi-arrow-left me-1"></i>
                                                Categories
                                            </button>
                                            <div className="fs-5 fw-bold text-dark mb-0">
                                                {selectedCategory.name}
                                            </div>
                                        </div>

                                        <div className="text-muted font-mono small">
                                            {displayedItems.length} Items Available
                                        </div>
                                    </div>

                                    {/* Items Grid */}
                                    <div className="row g-2 overflow-y-auto">
                                        {displayedItems.length === 0 ? (
                                            <div className="col-12 text-center py-5 text-muted">
                                                No items in this category.
                                            </div>
                                        ) : (
                                            displayedItems.map(item => (
                                                <div key={item.id} className="col-6 col-sm-4 col-md-4 col-lg-3 col-xl-2">
                                                    <div 
                                                        className="pos-item-tile shadow-2xs h-100"
                                                        onClick={() => addToCart(item)}
                                                    >
                                                        <div>
                                                            <div className="fw-bold text-dark text-truncate" title={item.name}>
                                                                {item.name}
                                                            </div>
                                                            <div className="text-muted small font-mono" style={{ fontSize: '11px' }}>
                                                                {item.code || `ID-${item.id}`}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center justify-content-between mt-2">
                                                            <span className="badge bg-light text-secondary border small" style={{ fontSize: '9px' }}>
                                                                {item.preparation_department?.toUpperCase() || 'KITCHEN'}
                                                            </span>
                                                            <span className="font-mono text-primary fw-bold fs-6">
                                                                ETB {parseFloat(item.price).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* B. RMS VIEW (Photo 2 Style) */}
                    {activeTopTab === 'RMS' && (
                        <div className="flex-grow-1 d-flex flex-column p-3 overflow-y-auto">
                            {/* RMS -> TABLE SUB-TAB */}
                            {rmsSubTab === 'TABLE' && (
                                <>
                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                        {/* Dining Area Switcher */}
                                        <div className="d-flex align-items-center gap-1 overflow-x-auto">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedAreaId('all')}
                                                className={`btn btn-sm ${selectedAreaId === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            >
                                                All Areas ({allTablesList.length})
                                            </button>
                                            {diningAreas.map(area => (
                                                <button
                                                    key={area.id}
                                                    type="button"
                                                    onClick={() => setSelectedAreaId(area.id)}
                                                    className={`btn btn-sm ${selectedAreaId === area.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                >
                                                    {area.name} ({area.tables ? area.tables.length : 0})
                                                </button>
                                            ))}
                                        </div>

                                        {/* Search Filter */}
                                        <div style={{ maxWidth: '200px' }}>
                                            <input
                                                type="text"
                                                value={tableSearchFilter}
                                                onChange={e => setTableSearchFilter(e.target.value)}
                                                placeholder="Search Table..."
                                                className="form-control form-control-sm border"
                                            />
                                        </div>
                                    </div>

                                    {/* Tables Grid with Instant Add Products & Settle */}
                                    <div className="row g-3">
                                        {filteredTablesList.map(table => {
                                            const isSelected = selectedTable && selectedTable.id === table.id;
                                            const isOccupied = table.status === 'occupied';
                                            const activeOrder = table.active_order;

                                            return (
                                                <div key={table.id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                                                    <div 
                                                        className={`card h-100 p-2.5 cursor-pointer transition-all border ${
                                                            isSelected 
                                                                ? 'bg-primary text-white border-primary shadow-md' 
                                                                : isOccupied 
                                                                    ? 'bg-warning bg-opacity-10 border-warning text-dark' 
                                                                    : (theme === 'dark' ? 'bg-dark bg-opacity-75 border-secondary border-opacity-25 text-white hover-lift' : 'bg-white border-secondary border-opacity-25 text-dark hover-lift')
                                                        }`}
                                                        onClick={() => handleSelectTable(table)}
                                                    >
                                                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                                                            <span className="badge bg-light text-secondary border font-mono">
                                                                {table.capacity || 4} Seats
                                                            </span>
                                                            <span className={`badge ${isSelected ? 'bg-white text-primary' : isOccupied ? 'bg-warning text-dark' : 'bg-success'}`}>
                                                                {isSelected ? 'SELECTED' : isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                                                            </span>
                                                        </div>

                                                        <div className="text-center py-2">
                                                            <div className="fs-3 fw-bold font-mono">T-{table.table_number}</div>
                                                            <small className={isSelected ? 'text-white-50' : 'text-muted'}>{table.area_name}</small>
                                                        </div>

                                                        {/* Quick Table Actions when Occupied */}
                                                        {isOccupied && activeOrder && (
                                                            <div className="mt-1 pt-1 border-top border-warning border-opacity-50 d-flex flex-column gap-1">
                                                                <div className="small font-mono text-truncate text-center" style={{ fontSize: '11px' }}>
                                                                    #{activeOrder.order_number.slice(-8)} &bull; <strong>ETB {parseFloat(activeOrder.total_amount || 0).toFixed(0)}</strong>
                                                                </div>
                                                                <div className="d-flex gap-1">
                                                                    {(can('pos.orders.edit') || can('pos.orders.create')) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); handleLoadOrderToEdit(activeOrder, true); }}
                                                                            className="btn btn-xs btn-outline-dark py-0 flex-fill fw-bold"
                                                                            title="Edit this order"
                                                                        >
                                                                            Edit Order
                                                                        </button>
                                                                    )}
                                                                    {(can('finance.view') || can('pos.orders.edit')) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); openSettleModal(activeOrder); }}
                                                                            className="btn btn-xs btn-success py-0 flex-fill fw-bold"
                                                                            title="Settle / Paid"
                                                                        >
                                                                            Settle
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* RMS -> WAITERS SUB-TAB (FROM HR WAITER DEPARTMENT) */}
                            {rmsSubTab === 'WAITERS' && (
                                <>
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div>
                                            <div className="fs-5 fw-bold text-dark">Staff / Waiter Directory</div>
                                            <small className="text-muted">Waiters retrieved from HR Module (Dining & Floor Service Department)</small>
                                        </div>
                                        <div style={{ maxWidth: '240px' }}>
                                            <input
                                                type="text"
                                                value={waiterSearchQuery}
                                                onChange={e => setWaiterSearchQuery(e.target.value)}
                                                placeholder="Filter staff..."
                                                className="form-control form-control-sm border"
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-3">
                                        {filteredWaiters.map(waiter => {
                                            const isSelected = selectedWaiter && selectedWaiter.id === waiter.id;
                                            return (
                                                <div key={waiter.id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                                                    <div
                                                        className={`card h-100 p-3 text-center border cursor-pointer transition-all ${
                                                            isSelected ? 'bg-primary text-white border-primary shadow-md' : (theme === 'dark' ? 'bg-dark bg-opacity-75 border-secondary border-opacity-25 text-white hover-lift' : 'bg-white text-dark hover-lift')
                                                        }`}
                                                        onClick={() => handleSelectWaiter(waiter)}
                                                    >
                                                        <div className="mb-2">
                                                            <div className={`rounded-circle d-inline-flex p-3 ${isSelected ? 'bg-white bg-opacity-25 text-white' : 'bg-light text-primary'}`}>
                                                                <i className="bi bi-person-fill fs-3"></i>
                                                            </div>
                                                        </div>
                                                        <div className="fw-bold text-truncate">{waiter.name}</div>
                                                        <small className={isSelected ? 'text-white-50' : 'text-muted'}>{waiter.username || 'Staff'}</small>
                                                        {isSelected && (
                                                            <div className="mt-2 badge bg-white text-primary">ASSIGNED</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                        </div>
                    )}

                    {/* C. REFERENCE VIEW (Photo 3 Style + SETTLE / PAID) */}
                    {activeTopTab === 'REFERENCE' && (
                        <div className="flex-grow-1 d-flex flex-column overflow-hidden">
                            {/* Orders Table Pane */}
                            <div className="flex-grow-1 overflow-auto p-2">
                                <table className="pos-ref-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '4%' }}>SN</th>
                                            <th style={{ width: '15%' }}>VoucherID</th>
                                            <th style={{ width: '15%' }}>Date & Time</th>
                                            <th style={{ width: '12%' }}>Total (ETB)</th>
                                            <th style={{ width: '10%' }}>Status</th>
                                            <th style={{ width: '12%' }}>Device Name</th>
                                            <th style={{ width: '12%' }}>Waiter</th>
                                            <th style={{ width: '10%' }}>Table</th>
                                            <th style={{ width: '8%' }}>Cover</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="text-center py-5 text-muted">
                                                    No orders found in reference log.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.map((ord, idx) => {
                                                const isSelected = selectedReferenceOrder && selectedReferenceOrder.id === ord.id;
                                                const orderTime = new Date(ord.created_at).toLocaleString();
                                                const waiterName = ord.waiter ? ord.waiter.name : (selectedWaiter ? selectedWaiter.name : 'Staff');
                                                const tableName = ord.table ? `T-${ord.table.table_number}` : 'Takeaway';
                                                const statusLabel = referenceStatusLabel(ord.status);

                                                return (
                                                    <tr
                                                        key={ord.id}
                                                        className={`pos-ref-row ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => setSelectedReferenceOrder(ord)}
                                                    >
                                                        <td>{idx + 1}</td>
                                                        <td className="font-mono fw-bold text-primary">#{ord.order_number}</td>
                                                        <td className="font-mono small">{orderTime}</td>
                                                        <td className="font-mono fw-bold">ETB {parseFloat(ord.total_amount).toFixed(2)}</td>
                                                        <td>
                                                            <span className={`badge ${statusLabel.className}`}>
                                                                {statusLabel.label}
                                                            </span>
                                                        </td>
                                                        <td>IRP 200D</td>
                                                        <td>{waiterName}</td>
                                                        <td>{tableName}</td>
                                                        <td className="text-center">{ord.guest_count || 1}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Bottom Action Bar matching Photo 3 Exactly + SETTLE & ADD ITEMS - Permission Guarded */}
                            <div className="d-flex align-items-center gap-1.5 p-2 bg-white border-top shrink-0 overflow-x-auto shadow-2xs">
                                {/* Settle / Paid Button */}
                                {(can('finance.view') || can('pos.orders.edit')) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedReferenceOrder) {
                                                addToast('Select Order', 'Click an order row to settle.', 'warning');
                                                return;
                                            }
                                            if (selectedReferenceOrder.status === 'completed') {
                                                addToast('Already Paid', 'This order is already marked as Paid / Settled.', 'info');
                                                return;
                                            }
                                            if (selectedReferenceOrder.status === 'cancelled') {
                                                addToast('Order Cancelled', 'This order has been cancelled.', 'warning');
                                                return;
                                            }
                                            openSettleModal(selectedReferenceOrder);
                                        }}
                                        className="pos-bottom-bar-btn rounded-1 btn-success text-white fw-bold"
                                        style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
                                    >
                                        <i className="bi bi-cash-coin me-1"></i>
                                        SETTLE / PAID
                                    </button>
                                )}

                                {(can('pos.orders.edit') || can('pos.orders.create')) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedReferenceOrder) {
                                                addToast('Select Order', 'Click an order row to edit.', 'warning');
                                                return;
                                            }
                                            if (selectedReferenceOrder.status === 'completed' || selectedReferenceOrder.status === 'cancelled') {
                                                addToast('Order Closed', 'This order can no longer be edited.', 'warning');
                                                return;
                                            }
                                            handleLoadOrderToEdit(selectedReferenceOrder, true);
                                        }}
                                        className="pos-bottom-bar-btn rounded-1 text-white fw-bold"
                                        style={{ backgroundColor: '#4f46e5', borderColor: '#4338ca' }}
                                    >
                                        <i className="bi bi-pencil-square me-1"></i>
                                        EDIT ORDER
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* D. FAVORITE VIEW */}
                    {activeTopTab === 'FAVORITE' && (
                        <div className="flex-grow-1 p-3 overflow-y-auto">
                            <div className="fs-5 fw-bold text-dark mb-3">Favorite Quick-Add Items</div>
                            {displayedItems.length === 0 ? (
                                <div className="text-muted">No favorite products yet. Mark a product as a favorite on the menu.</div>
                            ) : (
                            <div className="row g-2">
                                {displayedItems.map(item => (
                                    <div key={item.id} className="col-6 col-sm-4 col-md-3 col-xl-2">
                                        <div 
                                            className="pos-item-tile shadow-2xs h-100"
                                            onClick={() => addToCart(item)}
                                        >
                                            <div className="fw-bold text-dark text-truncate">{item.name}</div>
                                            <div className="d-flex align-items-center justify-content-between mt-2">
                                                <span className="badge bg-light text-secondary border small" style={{ fontSize: '9px' }}>
                                                    {item.preparation_department?.toUpperCase() || 'KITCHEN'}
                                                </span>
                                                <span className="font-mono text-primary fw-bold fs-6">
                                                    ETB {parseFloat(item.price).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    )}

                    {/* E. SEARCH VIEW */}
                    {activeTopTab === 'SEARCH' && (
                        <div className="flex-grow-1 d-flex flex-column p-3 overflow-hidden">
                            <div className="mb-3">
                                <input
                                    type="text"
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Type item name or code to search..."
                                    className="form-control form-control-lg border"
                                />
                            </div>

                            <div className="flex-grow-1 overflow-y-auto">
                                <div className="row g-2">
                                    {displayedItems.map(item => (
                                        <div key={item.id} className="col-6 col-sm-4 col-md-3 col-xl-2">
                                            <div 
                                                className="pos-item-tile shadow-2xs h-100"
                                                onClick={() => addToCart(item)}
                                            >
                                                <div>
                                                    <div className="fw-bold text-dark text-truncate">{item.name}</div>
                                                    <div className="text-muted small font-mono">{item.code}</div>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between mt-2">
                                                    <span className="badge bg-light text-secondary border small" style={{ fontSize: '9px' }}>
                                                        {item.category_name}
                                                    </span>
                                                    <span className="font-mono text-primary fw-bold fs-6">
                                                        ETB {parseFloat(item.price).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Mobile Cart Pill (Only on mobile when viewing content) */}
            {mobileView === 'content' && cart.length > 0 && (
                <div className="d-md-none position-fixed bottom-0 start-0 end-0 p-2 z-2" style={{ pointerEvents: 'none' }}>
                    <button
                        type="button"
                        onClick={() => setMobileView('docket')}
                        className="btn btn-primary w-100 shadow-lg py-2.5 px-3 fw-bold d-flex align-items-center justify-content-between"
                        style={{ pointerEvents: 'auto', borderRadius: '12px' }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-white text-primary font-mono">{cartTotals.itemCount} Items</span>
                            <span>Open Docket</span>
                        </div>
                        <div className="font-mono fs-6 fw-bolder">
                            ETB {cartTotals.grandTotal.toFixed(2)} &rarr;
                        </div>
                    </button>
                </div>
            )}

            {/* 3. MODALS & POPUPS */}

            {/* Settle / Paid Modal */}
            {showSettleModal && orderToSettle && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1080 }}>
                    <div className="modal-dialog modal-dialog-centered modal-sm">
                        <div className="modal-content border shadow-lg">
                            <div className="modal-header py-2">
                                <h5 className="modal-title fs-6 fw-bold">Settle</h5>
                                <button type="button" className="btn-close" onClick={() => setShowSettleModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="text-center mb-3">
                                    <div className="small text-muted">
                                        #{orderToSettle.order_number} · {orderToSettle.table ? `T-${orderToSettle.table.table_number}` : 'Takeaway'}
                                    </div>
                                    <div className="fw-bolder font-mono text-success" style={{ fontSize: '1.75rem' }}>
                                        ETB {parseFloat(orderToSettle.total_amount).toFixed(2)}
                                    </div>
                                </div>

                                <div className="d-flex flex-wrap gap-1 mb-3">
                                    {[
                                        { id: 'cash', label: 'Cash' },
                                        { id: 'telebirr', label: 'Telebirr' },
                                        { id: 'cbe_birr', label: 'CBE Birr' },
                                        { id: 'card', label: 'Card' },
                                    ].map(pm => (
                                        <button
                                            key={pm.id}
                                            type="button"
                                            onClick={() => setSettlePaymentMethod(pm.id)}
                                            className={`btn btn-sm flex-fill fw-bold ${
                                                settlePaymentMethod === pm.id ? 'btn-primary' : 'btn-outline-secondary'
                                            }`}
                                        >
                                            {pm.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="form-label fw-bold small mb-0">Tendered</label>
                                        <button
                                            type="button"
                                            onClick={() => setSettleAmountTendered(parseFloat(orderToSettle.total_amount).toFixed(2))}
                                            className="btn btn-link btn-sm p-0"
                                        >
                                            Exact
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settleAmountTendered}
                                        onChange={e => setSettleAmountTendered(e.target.value)}
                                        placeholder={parseFloat(orderToSettle.total_amount).toFixed(2)}
                                        className="form-control font-mono fw-bold text-end"
                                    />
                                    {settleAmountTendered && parseFloat(settleAmountTendered) >= parseFloat(orderToSettle.total_amount) && (
                                        <div className="d-flex justify-content-between small mt-2">
                                            <span className="text-muted">Change</span>
                                            <strong className="font-mono">
                                                ETB {(parseFloat(settleAmountTendered) - parseFloat(orderToSettle.total_amount)).toFixed(2)}
                                            </strong>
                                        </div>
                                    )}
                                </div>

                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="printReceiptToggle"
                                        checked={printReceiptOnSettle}
                                        onChange={e => setPrintReceiptOnSettle(e.target.checked)}
                                    />
                                    <label className="form-check-label small" htmlFor="printReceiptToggle">
                                        Print receipt
                                    </label>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleConfirmSettleOrder}
                                    disabled={isSubmitting}
                                    className="btn btn-success fw-bold w-100"
                                >
                                    {isSubmitting ? 'Paying...' : 'Pay'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Retrieve Order Modal */}
            {showRetrieveModal && selectedReferenceOrder && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border shadow-lg">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fs-6 text-dark fw-bold">
                                    Order #{selectedReferenceOrder.order_number} Details
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowRetrieveModal(false)}></button>
                            </div>
                            <div className="modal-body p-3">
                                <div className="row g-2 mb-3 small bg-light p-2 rounded border">
                                    <div className="col-3">
                                        <span className="text-muted">Table:</span> <strong>{selectedReferenceOrder.table ? `T-${selectedReferenceOrder.table.table_number}` : 'Takeaway'}</strong>
                                    </div>
                                    <div className="col-3">
                                        <span className="text-muted">Waiter:</span> <strong>{selectedReferenceOrder.waiter ? selectedReferenceOrder.waiter.name : 'Staff'}</strong>
                                    </div>
                                    <div className="col-3">
                                        <span className="text-muted">Status:</span> 
                                        <span className={`badge ms-1 ${referenceStatusLabel(selectedReferenceOrder.status).className}`}>
                                            {referenceStatusLabel(selectedReferenceOrder.status).short}
                                        </span>
                                    </div>
                                    <div className="col-3 text-end">
                                        <span className="text-muted">Total:</span> <strong className="text-primary font-mono fs-6">ETB {parseFloat(selectedReferenceOrder.total_amount).toFixed(2)}</strong>
                                    </div>
                                </div>

                                <div className="border rounded p-2 mb-3 bg-white" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    <table className="table table-sm mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Item</th>
                                                <th className="text-center">Qty</th>
                                                <th className="text-end">Price</th>
                                                <th className="text-end">Total (ETB)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...(selectedReferenceOrder.items || [])]
                                                .sort((left, right) => Number(left.status === 'cancelled' || left.status === 'voided') - Number(right.status === 'cancelled' || right.status === 'voided') || left.id - right.id)
                                                .map(it => (
                                                <tr key={it.id} className={it.status === 'cancelled' || it.status === 'voided' ? 'pos-voided-row' : ''}>
                                                    <td>{it.name || (it.menu_item ? it.menu_item.name : 'Item')}</td>
                                                    <td className="text-center font-mono">{it.quantity}</td>
                                                    <td className="text-end font-mono">{parseFloat(it.unit_price).toFixed(2)}</td>
                                                    <td className="text-end font-mono fw-bold">{parseFloat(it.total_price || it.subtotal || (it.quantity * it.unit_price)).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                    <div className="d-flex align-items-center gap-1.5">
                                        {selectedReferenceOrder.status !== 'completed' && selectedReferenceOrder.status !== 'cancelled' && (can('pos.orders.edit') || can('pos.orders.create')) && (
                                            <button
                                                type="button"
                                                onClick={() => handleLoadOrderToEdit(selectedReferenceOrder, true)}
                                                className="btn btn-primary btn-sm fw-bold"
                                            >
                                                <i className="bi bi-pencil-square me-1"></i>
                                                Edit Order
                                            </button>
                                        )}

                                        {/* 1-touch Settle Button */}
                                        {selectedReferenceOrder.status !== 'completed' && selectedReferenceOrder.status !== 'cancelled' && (can('finance.view') || can('pos.orders.edit')) && (
                                            <button
                                                type="button"
                                                onClick={() => openSettleModal(selectedReferenceOrder)}
                                                className="btn btn-success btn-sm fw-bold"
                                            >
                                                <i className="bi bi-cash-stack me-1"></i>
                                                Settle / Paid
                                            </button>
                                        )}
                                    </div>

                                    {/* Ticket Reprint */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedReferenceOrder.tickets && selectedReferenceOrder.tickets.length > 0) {
                                                selectedReferenceOrder.tickets.forEach(ticket => {
                                                    const ticketHtml = buildIrp200dTicketHtml(selectedReferenceOrder, ticket, appName);
                                                    printIrp200d(ticketHtml);
                                                });
                                                addToast('Reprinted', 'Order tickets sent to IRP 200D', 'success');
                                            } else {
                                                addToast('No Tickets', 'No station tickets attached to this order', 'warning');
                                            }
                                        }}
                                        className="btn btn-outline-dark btn-sm fw-bold"
                                    >
                                        <i className="bi bi-printer-fill me-1"></i>
                                        Reprint to IRP 200D
                                    </button>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowRetrieveModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Notes Modal */}
            {itemNotesModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border shadow-md">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fs-6 fw-bold">
                                    Prep Notes: {itemNotesModal.name}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setItemNotesModal(null)}></button>
                            </div>
                            <div className="modal-body">
                                <label className="form-label text-muted small">Special Instructions (Kitchen / Bar Ticket)</label>
                                <textarea
                                    className="form-control font-mono"
                                    rows="3"
                                    defaultValue={itemNotesModal.notes}
                                    id="item-notes-textarea"
                                    placeholder="e.g. Less spicy, extra sauce, ice on side..."
                                ></textarea>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setItemNotesModal(null)}>Cancel</button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary btn-sm fw-bold"
                                    onClick={() => {
                                        const val = document.getElementById('item-notes-textarea').value;
                                        saveItemNotes(itemNotesModal.id, val);
                                    }}
                                >
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Void or cancel confirmation */}
            {pendingConfirm && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border shadow-md">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fs-6 fw-bold">
                                    {pendingConfirm.kind === 'void' ? 'Void item' : 'Cancel editing'}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setPendingConfirm(null)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0 text-muted">
                                    {pendingConfirm.kind === 'void'
                                        ? `Void ${pendingConfirm.itemName} from this order? This removes it from the docket.`
                                        : `Cancel editing${editingOrder ? ` order #${editingOrder.order_number}` : ''}? Unsaved changes will be discarded.`}
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPendingConfirm(null)}>
                                    {pendingConfirm.kind === 'void' ? 'Keep item' : 'Keep editing'}
                                </button>
                                {pendingConfirm.kind === 'void' ? (
                                    <button type="button" className="btn btn-danger btn-sm fw-bold" onClick={confirmVoidItem}>
                                        Void item
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-danger btn-sm fw-bold" onClick={() => { setPendingConfirm(null); handleCancelEditOrder(); }}>
                                        Discard changes
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit POS Confirmation Modal */}
            {showExitModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border shadow-md">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fs-6 fw-bold">Exit POS Terminal</h5>
                                <button type="button" className="btn-close" onClick={() => setShowExitModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0 text-muted">
                                    Are you sure you want to return to the Core ERP Dashboard? Any unsaved cart items will be cleared.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowExitModal(false)}>Stay in POS</button>
                                <a href={routes.dashboard || '/'} className="btn btn-danger btn-sm fw-bold">
                                    Exit to Dashboard
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. FLOATING TOAST NOTIFICATIONS */}
            <div 
                className="position-fixed bottom-0 end-0 p-3 z-3 d-flex flex-column gap-2"
                style={{ maxWidth: '340px', pointerEvents: 'none' }}
            >
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className={`toast show border-0 shadow-lg text-white ${
                            toast.type === 'danger' ? 'bg-danger' :
                            toast.type === 'warning' ? 'bg-warning text-dark' :
                            toast.type === 'info' ? 'bg-info text-dark' :
                            'bg-success'
                        }`}
                        role="alert"
                        style={{ pointerEvents: 'auto', borderRadius: '6px' }}
                    >
                        <div className="d-flex align-items-center justify-content-between p-2.5">
                            <div className="d-flex align-items-center gap-2">
                                <i className={`bi fs-5 ${
                                    toast.type === 'danger' ? 'bi-x-circle-fill' :
                                    toast.type === 'warning' ? 'bi-exclamation-triangle-fill' :
                                    toast.type === 'info' ? 'bi-info-circle-fill' :
                                    'bi-check-circle-fill'
                                }`}></i>
                                <div>
                                    <div className="fw-bold small lh-1">{toast.title}</div>
                                    <div className="small opacity-90">{toast.message}</div>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="btn-close btn-close-white ms-2"
                                onClick={() => removeToast(toast.id)}
                            ></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
