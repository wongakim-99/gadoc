'use client';

import { DatabaseWorkspace } from '@/src/features/database/ui/DatabaseWorkspace';
import { useCallback, useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, databaseApi, documentApi, teamApi } from '@/lib/api-client';
import { hasTeamWriteAccess, resolveCurrentTeamMember } from '@/src/entities/team/lib/access';
import type { KnowledgeDatabase } from '@/src/features/database/model/types';
import type { DocumentNode } from '@/src/entities/document/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { DocumentTree } from '@/src/widgets/document/ui/DocumentTree';
import { createDocumentHubTemplate } from '@slacord/document-core';
import { LayoutTemplate } from 'lucide-react';

interface Props {
    params: Promise<{ teamId: string }>;
}

export default function DocsPage({ params }: Props) {
    const { teamId } = use(params);
    const searchParams = useSearchParams();
    if (searchParams.get('database'))
        return (
            <DatabaseWorkspace
                key={searchParams.get('database') ?? 'index'}
                teamId={teamId}
                databaseId={searchParams.get('database')}
            />
        );
    return <DocumentIndex teamId={teamId} />;
}

function DocumentIndex({ teamId }: { teamId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentId = searchParams.get('parentId');
    const [docs, setDocs] = useState<DocumentNode[]>([]);
    const parent = docs.find((doc) => doc.id === parentId);
    const [canWrite, setCanWrite] = useState(false);
    const creating = useRef(false);
    const automaticCreation = useRef<string | null>(null);

    const [error, setError] = useState('');
    const [databases, setDatabases] = useState<KnowledgeDatabase[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        Promise.all([documentApi.getDocuments(teamId), databaseApi.list(teamId)])
            .then(([response, sources]) => {
                if (active && sources.success) setDatabases(sources.data ?? []);
                if (active && response.success && Array.isArray(response.data))
                    setDocs(response.data as DocumentNode[]);
            })
            .catch((caught) => {
                if (active) setError(caught instanceof Error ? caught.message : '문서를 불러오지 못했습니다.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [teamId]);

    useEffect(() => {
        let active = true;
        Promise.all([authApi.getMe().catch(() => null), teamApi.getMembers(teamId).catch(() => null)]).then(
            ([meRes, memberRes]) => {
                if (!active) return;
                const currentUserId = (meRes?.data as { id?: string } | undefined)?.id ?? '';
                const members =
                    memberRes?.success && Array.isArray(memberRes.data) ? (memberRes.data as TeamMemberSummary[]) : [];
                setCanWrite(hasTeamWriteAccess(resolveCurrentTeamMember(members, currentUserId)?.role));
            },
        );
        return () => {
            active = false;
        };
    }, [teamId]);

    const handleCreate = useCallback(async (template: 'blank' | 'hub' = 'blank') => {
        if (!canWrite || creating.current) return;
        creating.current = true;
        setSaving(true);
        setError('');
        try {
            if (parentId && (!parent || loading))
                throw new Error('상위 페이지를 확인할 수 없습니다. 페이지 목록에서 다시 선택해 주세요.');
            const res = await documentApi.createDocument(teamId, {
                parentId,
                title: template === 'hub' ? '문서 허브' : '제목 없음',
                content: template === 'hub' ? JSON.stringify(createDocumentHubTemplate()) : '[]',
                contentFormat: 'json',
            });
            if (!res.success || !res.data) throw new Error('문서를 생성하지 못했습니다.');
            const nextDoc = res.data as DocumentNode;
            setDocs((prev) => [...prev, nextDoc]);
            window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));
            router.replace(`/${teamId}/docs/${nextDoc.id}?new=1`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '문서를 생성하지 못했습니다.');
        } finally {
            creating.current = false;
            setSaving(false);
        }
    }, [canWrite, parentId, parent, loading, teamId, router]);
    const createRequested = searchParams.get('create') === '1';
    useEffect(() => {
        if (!createRequested) {
            automaticCreation.current = null;
            return;
        }
        if (loading || !canWrite) return;
        const key = teamId + ':' + (parentId ?? 'root');
        if (automaticCreation.current === key) return;
        automaticCreation.current = key;
        void handleCreate();
    }, [createRequested, loading, canWrite, teamId, parentId, handleCreate]);

    return (
        <div className="min-h-full">
            <div className="workspace-topbar">
                <div>
                    <h2 className="text-xl font-bold text-white">문서</h2>
                </div>
                {canWrite ? (
                    <button
                        disabled={saving || loading}
                        onClick={() => void handleCreate()}
                        className="px-4 py-2 rounded-lg bg-slack-green text-white text-sm font-medium hover:bg-slack-green/90 transition-colors"
                    >
                        {saving ? '생성 중…' : '새 페이지'}
                    </button>
                ) : null}
            </div>

            <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
                {canWrite && !loading && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-5">
                    <div><h3 className="text-sm font-semibold text-text-primary">문서를 연결해 팀의 시작 페이지로</h3>
                        <p className="mt-1 text-xs text-text-secondary">섹션과 여러 열에 문서·링크·업무를 자유롭게 배치하세요.</p></div>
                    <button type="button" disabled={saving} onClick={() => void handleCreate('hub')}
                        className="inline-flex items-center gap-2 rounded-control border border-border-primary px-3 py-2 text-sm hover:bg-bg-hover disabled:opacity-50">
                        <LayoutTemplate size={16} /> 문서 허브 만들기
                    </button>
                </div>}
                {error && (
                    <p role="alert" className="text-sm text-red-300">
                        {error}
                    </p>
                )}
                {loading ? (
                    <p role="status">문서를 불러오는 중입니다.</p>
                ) : (
                    !error && (
                        <DocumentTree documents={docs} databases={databases} teamId={teamId} canCreate={canWrite} />
                    )
                )}
            </div>
        </div>
    );
}
