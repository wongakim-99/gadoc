'use client';
import Link from 'next/link';
import { useProjects } from '@/src/features/project/model/useProjects';
import { useProjectScope } from '@/src/features/project/model/useProjectScope';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { databaseApi, documentApi, unwrapApiArray } from '@/lib/api-client';
import type { KnowledgeDatabase } from '@/src/features/database/model/types';
import type { DocumentFull, DocumentNode } from '@/src/entities/document/types';
import { DocumentTree } from '@/src/widgets/document/ui/DocumentTree';
import { DocumentLoading } from '@/src/features/document/ui/DocumentLoading';
export function DocumentNavigation({ teamId, canWrite }: { teamId: string; canWrite: boolean }) {
    const pathname = usePathname();
    const { projectId } = useProjectScope(teamId);
    const { projects } = useProjects(teamId);
    const scopedProject = projects.find((project) => project.id === projectId);
    const rootId = scopedProject?.documentId;
    const visibleIds = new Set<string>(rootId ? [rootId] : []);
    // Resolve descendants regardless of API ordering.

    const [documents, setDocuments] = useState<DocumentNode[]>([]);
    const [databases, setDatabases] = useState<KnowledgeDatabase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [response, sources] = await Promise.all([
                    documentApi.getDocuments(teamId),
                    databaseApi.list(teamId),
                ]);
                if (active && sources.success) setDatabases(sources.data ?? []);
                if (!response.success) throw new Error('페이지 목록을 불러오지 못했습니다.');
                if (active) setDocuments(unwrapApiArray<DocumentNode>(response));
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : '페이지 목록 오류');
            } finally {
                if (active) setLoading(false);
            }
        };
        const update = (event: Event) => {
            const doc = (event as CustomEvent<DocumentFull>).detail;
            if (doc.teamId === teamId)
                setDocuments((current) =>
                    current.map((item) =>
                        item.id === doc.id ? { ...item, title: doc.title, updatedAt: doc.updatedAt } : item,
                    ),
                );
        };
        void load();
        window.addEventListener('slacord:document-updated', update);
        window.addEventListener('slacord:documents-refresh', load);
        window.addEventListener('slacord:database-updated', load);
        return () => {
            active = false;
            window.removeEventListener('slacord:document-updated', update);
            window.removeEventListener('slacord:documents-refresh', load);
            window.removeEventListener('slacord:database-updated', load);
        };
    }, [teamId, pathname]);

    if (rootId) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const doc of documents) {
                if (doc.parentId && visibleIds.has(doc.parentId) && !visibleIds.has(doc.id)) {
                    visibleIds.add(doc.id);
                    changed = true;
                }
            }
        }
    }
    const visibleDocuments = rootId
        ? documents
              .filter((doc) => visibleIds.has(doc.id))
              .map((doc) => (doc.id === rootId ? { ...doc, parentId: null } : doc))
        : scopedProject
          ? []
          : documents;
    const visibleDatabases = rootId
        ? databases.filter((db) => db.parentDocumentId && visibleIds.has(db.parentDocumentId))
        : scopedProject
          ? []
          : databases;
    const tree = (
        <>
            <div className="mb-3 flex min-h-8 items-center justify-between pl-3">
                <Link className="text-xs font-medium text-neutral-400 hover:text-white" href={`/${teamId}/docs`}>
                    페이지
                </Link>
                {canWrite && (
                    <Link
                        href={`/${teamId}/docs?create=1`}
                        aria-label="페이지 추가"
                        className="flex h-8 w-8 items-center justify-center rounded-control text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                    >
                        <Plus size={16} />
                    </Link>
                )}
            </div>
            {loading && <DocumentLoading compact />}
            {error && (
                <p role="alert" className="text-xs text-red-300">
                    {error}
                </p>
            )}
            {!loading && !error && (
                <DocumentTree
                    documents={visibleDocuments}
                    databases={visibleDatabases}
                    teamId={teamId}
                    canCreate={canWrite}
                />
            )}
        </>
    );
    return tree;
}
