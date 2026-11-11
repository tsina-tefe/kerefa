import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';

interface PageLink {
    url: string | null;
    label: string;
    active: boolean;
}

export default function TablePagination({
    links,
    total,
    to,
    from,
}: {
    links: PageLink[];
    total: number;
    to: number | null;
    from: number | null;
}) {
    return (
        <div className="flex flex-col items-center justify-between gap-4 border-t bg-white px-8 pt-5 sm:flex-row dark:bg-gray-800">
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                    Showing {from ?? 0} to {to ?? 0} of {total} results
                </span>
            </div>
            <div className="flex items-center space-x-2">
                {links.map((link, index) =>
                    link.url !== null ? (
                        <Link href={link.url || '#'} key={index}>
                            <Button variant="outline" className={link.active ? 'bg-blue-500 text-white' : ''} size="sm" dangerouslySetInnerHTML={{ __html: link.label }} />
                        </Link>
                    ) : (
                        <Button key={index} variant="outline" size="sm" disabled dangerouslySetInnerHTML={{ __html: link.label }} />
                    ),
                )}
            </div>
        </div>
    );
}
