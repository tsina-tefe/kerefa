import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { usePermission } from '@/hooks/use-permission';
import { type NavItem, type NavSection } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function NavMain({ sections = [] }: { sections: NavSection[] }) {
    const { can } = usePermission();

    return (
        <>
            {sections.map((section) => {
                const visibleItems = section.items.filter((item) => can(item.permission));

                if (visibleItems.length === 0) {
                    return null;
                }

                return <NavSectionBlock key={section.label} section={section} visibleItems={visibleItems} />;
            })}
        </>
    );
}

function isNavItemActive(pageUrl: string, url: string): boolean {
    const path = pageUrl.split('?')[0];

    return url.length > 0 && (path === url || path.startsWith(`${url}/`));
}

function NavSectionBlock({ section, visibleItems }: { section: NavSection; visibleItems: NavItem[] }) {
    const page = usePage();
    const storageKey = `sidebar-section-${section.label}`;

    const isSectionActive = useMemo(() => visibleItems.some((item) => isNavItemActive(page.url, item.url)), [page.url, visibleItems]);

    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') {
            return isSectionActive;
        }

        const stored = localStorage.getItem(storageKey);

        if (stored !== null) {
            return stored === 'true';
        }

        return isSectionActive;
    });

    useEffect(() => {
        if (isSectionActive) {
            setIsOpen(true);
        }
    }, [isSectionActive]);

    useEffect(() => {
        localStorage.setItem(storageKey, String(isOpen));
    }, [isOpen, storageKey]);

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarMenu>
                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={section.label}>
                                {section.icon && <section.icon />}
                                <span className="font-semibold">{section.label}</span>
                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                {visibleItems.map((item) => (
                                    <SidebarMenuSubItem key={`${section.label}-${item.title}`}>
                                        <SidebarMenuSubButton asChild isActive={isNavItemActive(page.url, item.url)}>
                                            <Link href={item.url} prefetch>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                ))}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </SidebarMenuItem>
                </Collapsible>
            </SidebarMenu>
        </SidebarGroup>
    );
}
