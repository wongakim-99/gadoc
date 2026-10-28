'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { getDocumentAncestors } from '@/src/entities/document/lib/getDocumentAncestors';
import { buildDocumentTree, type DocumentTreeNode } from '@/src/entities/document/lib/buildDocumentTree';
import { collectExpandedIds, filterDocumentTree } from '@/src/entities/document/lib/filterDocumentTree';
import type { DocumentNode } from '@/src/entities/document/types';
import type { KnowledgeDatabase } from '@/src/features/database/model/types';
import { DocumentTreeBranch } from './DocumentTreeBranch';
import { DocumentTreeSearch } from './DocumentTreeSearch';

interface Props {
    documents: DocumentNode[];
    databases?: KnowledgeDatabase[];
    teamId: string;
    canCreate?: boolean;
}

export function DocumentTree({ documents, databases, teamId, canCreate = false }: Props) {
    const roots = useMemo(() => {
        const entries: DocumentTreeNode[] = documents.map((doc) => ({ ...doc, children: [] }));
        for (const db of databases ?? [])
            entries.push({
                id: 'database:' + db.id,
                databaseId: db.id,
                title: db.name,
                teamId,
                parentId: db.parentDocumentId ?? null,
                children: [],
                createdBy: '',
                updatedBy: '',
                createdAt: '',
                updatedAt: '',
            });
        return buildDocumentTree(entries);
    }, [documents, databases, teamId]);
    const pathname = usePathname();
    const [query, setQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const search = useSearchParams();
    const activeHref = useWorkspaceConnection()?.activeHref ?? pathname + '?' + search.toString();
    const [activePath, activeQuery] = activeHref.split('?');
    const source = databases?.find((db) => db.id === new URLSearchParams(activeQuery).get('database'));
    const activeId = source?.parentDocumentId ?? activePath.split('/').at(-1) ?? '';
    const ancestorKey = [
        ...getDocumentAncestors(documents, activeId).map((doc) => doc.id),
        ...(source?.parentDocumentId ? [source.parentDocumentId] : []),
    ].join(',');
    useEffect(() => {
        setExpandedIds((current) => new Set([...current, ...ancestorKey.split(',').filter(Boolean)]));
    }, [ancestorKey]);
    const filteredRoots = useMemo(() => filterDocumentTree(roots, query), [query, roots]);
    const visibleExpandedIds = useMemo(
        () => (query.trim() ? collectExpandedIds(filteredRoots) : expandedIds),
        [expandedIds, filteredRoots, query],
    );

    if (roots.length === 0) {
        return <p className="py-12 text-center text-sm text-text-tertiary">페이지가 없습니다.</p>;
    }

    return (
        <div className="space-y-4">
            <DocumentTreeSearch onChange={setQuery} query={query} />
            {filteredRoots.length === 0 ? (
                <p className="rounded-2xl border border-border-primary bg-bg-secondary px-4 py-6 text-center text-sm text-text-tertiary">
                    검색 조건에 맞는 문서를 찾지 못했습니다.
                </p>
            ) : (
                <div className="space-y-2">
                    {filteredRoots.map((node) => (
                        <DocumentTreeBranch
                            key={node.id}
                            depth={0}
                            expandedIds={visibleExpandedIds}
                            node={node}
                            onToggle={(id) => setExpandedIds((prev) => toggleExpanded(prev, id))}
                            teamId={teamId}
                            canCreate={canCreate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function toggleExpanded(current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
}
