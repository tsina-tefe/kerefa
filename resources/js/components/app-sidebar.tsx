import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavSection } from '@/types';
import { Link } from '@inertiajs/react';
import { Building, Building2, ClipboardList, LayoutDashboard, LayoutGrid, LockKeyhole, Package, Printer, Receipt, ScrollText, Settings, Shield, ShoppingCart, Users, UtensilsCrossed } from 'lucide-react';
import AppLogo from './app-logo';

const sections: NavSection[] = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        items: [{ title: 'Overview', url: '/dashboard', icon: LayoutDashboard }],
    },
    {
        label: 'POS Management',
        icon: ShoppingCart,
        items: [
            { title: 'POS Terminal', url: '/pos', icon: ShoppingCart, permission: 'pos.view' },
            { title: 'Table Floor Plan', url: '/tables', icon: LayoutGrid, permission: 'pos.view' },
            { title: 'Orders', url: '/orders', icon: Receipt, permission: 'pos.view' },
            { title: 'Menu & Products', url: '/menu', icon: UtensilsCrossed, permission: 'pos.menu.manage' },
        ],
    },
    {
        label: 'Supply Chain',
        icon: Package,
        items: [
            { title: 'Stock & Inventory', url: '/inventory', icon: Package, permission: 'inventory.view' },
            { title: 'Procurement', url: '/procurement', icon: ClipboardList, permission: 'procurement.view' },
        ],
    },
    {
        label: 'System Administration',
        icon: Settings,
        items: [
            { title: 'Users', url: '/users', icon: Users, permission: 'users.view' },
            { title: 'Roles', url: '/roles', icon: Shield, permission: 'roles.view' },
            { title: 'Permissions', url: '/permissions', icon: LockKeyhole, permission: 'permissions.view' },
            { title: 'Branches', url: '/branches', icon: Building2, permission: 'branches.view' },
            { title: 'Departments', url: '/departments', icon: Building, permission: 'departments.view' },
            { title: 'Stations', url: '/stations', icon: Printer, permission: 'settings.view' },
            { title: 'Settings', url: '/system-settings', icon: Settings, permission: 'settings.view' },
            { title: 'Audit Trail', url: '/audit-logs', icon: ScrollText, permission: 'audit.view' },
        ],
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain sections={sections} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
