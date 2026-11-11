import { Link } from '@inertiajs/react';

interface PageLink {
    url: string | null;
    label: string;
    active: boolean;
}

export function Pagination({ links = [] }: { links?: PageLink[] }) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2 text-sm">
            {links.map((link, index) =>
                link.url ? (
                    <Link
                        key={index}
                        href={link.url}
                        className={`rounded border px-2 py-1 ${link.active ? 'border-primary font-semibold' : ''}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span key={index} className="text-muted-foreground rounded border px-2 py-1" dangerouslySetInnerHTML={{ __html: link.label }} />
                ),
            )}
        </div>
    );
}
