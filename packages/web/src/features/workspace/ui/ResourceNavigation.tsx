'use client';
import { useRouter } from 'next/navigation';
import { Columns2 } from 'lucide-react';
import { canLeaveWorkspacePane, useWorkspaceConnection } from '../model/useWorkspaceConnection';

export function ResourceNavigation({ href, title }: { href: string; title: string }) {
    const connection = useWorkspaceConnection();
    const router = useRouter();
    return (
        <>
            <a
                href={href}
                className="min-w-0 flex-1 break-words text-sm text-action-text hover:underline"
                onClick={async (event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    if (await canLeaveWorkspacePane()) router.push(href);
                }}
            >
                {title}
            </a>
            {connection && (
                <button
                    type="button"
                    aria-label={`${title} 옆에 열기`}
                    onClick={() => connection.open(href, title)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover"
                >
                    <Columns2 size={14} />
                    옆에 열기
                </button>
            )}
        </>
    );
}
