'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import type { DocumentTreeNode } from '@/src/entities/document/lib/buildDocumentTree';

interface Props {
    depth: number;
    expandedIds: Set<string>;
    node: DocumentTreeNode;
    onToggle: (id: string) => void;
    teamId: string;
    canCreate?: boolean;
}

export function DocumentTreeBranch({ depth, expandedIds, node, onToggle, teamId, canCreate }: Props) {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const href = `/${teamId}/docs/${node.id}`;
    const active = usePathname() === href;

    return (
        <div>
            <div className="group flex items-center gap-0.5" style={{ marginLeft: `${Math.min(depth, 8) * 12}px` }}>
                {hasChildren ? (
                    <button
                        aria-label={`${node.title} 하위 페이지 ${expanded ? '접기' : '펼치기'}`}
                        aria-expanded={expanded}
                        onClick={() => onToggle(node.id)}
                        className="shrink-0 rounded p-1 text-text-tertiary transition hover:bg-bg-hover hover:text-white"
                    >
                        <svg
                            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                ) : (
                    <span className="w-5" />
                )}
                <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-bg-hover ${active ? 'bg-bg-hover text-white' : 'text-text-secondary'}`}
                >
                    <FileText size={15} className="shrink-0 text-text-tertiary" />
                    <div className="min-w-0">
                        <p className="truncate font-medium">{node.title}</p>
                    </div>
                </Link>
                {canCreate && (
                    <Link
                        href={`/${teamId}/docs?create=1&parentId=${encodeURIComponent(node.id)}`}
                        aria-label={`${node.title} 아래 페이지 추가`}
                        title="하위 페이지 추가"
                        className="shrink-0 rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-white focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    >
                        <Plus size={15} />
                    </Link>
                )}
            </div>
            {hasChildren && expanded ? (
                <div className="space-y-0.5">
                    {node.children.map((child) => (
                        <DocumentTreeBranch
                            key={child.id}
                            depth={depth + 1}
                            expandedIds={expandedIds}
                            node={child}
                            onToggle={onToggle}
                            teamId={teamId}
                            canCreate={canCreate}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
