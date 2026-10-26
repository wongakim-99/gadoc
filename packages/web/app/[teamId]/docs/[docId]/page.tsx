'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PanelLeft, MessageSquare, History, Maximize2 } from 'lucide-react';
import { DocumentTree } from '@/src/widgets/document/ui/DocumentTree';
import { getDocumentAncestors } from '@/src/entities/document/lib/getDocumentAncestors';
import { useRouter, useSearchParams } from 'next/navigation';
import { documentApi } from '@/lib/api-client';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { useDocumentDetail } from '@/src/features/document/model/useDocumentDetail';
import { useDocumentVersions } from '@/src/features/document/model/useDocumentVersions';
import { DocumentChildrenPanel } from '@/src/features/document/ui/DocumentChildrenPanel';
import { DocumentCommentPanel } from '@/src/features/document/ui/DocumentCommentPanel';
import { DocumentContent } from '@/src/features/document/ui/DocumentContent';
import { DocumentDetailHeader } from '@/src/features/document/ui/DocumentDetailHeader';
import dynamic from 'next/dynamic';
const DocumentEditorPanel = dynamic(
    () => import('@/src/features/document/ui/DocumentEditorPanel').then((m) => m.DocumentEditorPanel),
    { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-bg-secondary" /> },
);
import { DocumentVersionPanel } from '@/src/features/document/ui/DocumentVersionPanel';
import type { DocumentFull } from '@/src/entities/document/types';
import { ConfirmationDialog } from '@/src/shared/ui/ConfirmationDialog';

type PendingConfirmation = { kind: 'archive' } | { kind: 'restore-version'; versionId: string };

interface Props {
    params: Promise<{ teamId: string; docId: string }>;
}

export default function DocDetailPage({ params }: Props) {
    const { teamId, docId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { doc, setDoc, documents, children, loading, error: loadError } = useDocumentDetail(teamId, docId);
    const workspace = useTeamWorkspaceData(teamId);
    const { loading: versionLoading, restoreVersion, versions } = useDocumentVersions(teamId, docId);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [actionError, setActionError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
    const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [editorReady, setEditorReady] = useState(false);
    const savingRef = useRef(false);
    const [showTree, setShowTree] = useState(false);
    const [panel, setPanel] = useState<'comments' | 'history' | null>(null);
    const [fullWidth, setFullWidth] = useState(false);
    const dirty = editing && !!doc && (title !== doc.title || content !== doc.content);

    useEffect(() => {
        if (!doc) return;
        setTitle(doc.title);
        setContent(doc.content);
        setEditorReady(false);
        setEditing(searchParams.get('edit') === '1' && doc.canEdit !== false);
    }, [doc, searchParams]);

    useEffect(() => {
        if (editing) {
            setSelectedQuote(null);
        }
    }, [editing]);

    const handleSave = useCallback(async () => {
        if (!doc || !editorReady || doc.canEdit === false || savingRef.current) return;
        if (!title.trim()) {
            setActionError('페이지 제목을 입력해 주세요.');
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setActionError('');
        try {
            const response = await documentApi.updateDocument(teamId, docId, {
                title: title.trim(),
                content,
                contentFormat: 'json',
            });
            if (!response.success || !response.data)
                throw new Error('저장하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도해 주세요.');
            const nextDoc = response.data as DocumentFull;
            setDoc(nextDoc);
            setTitle(nextDoc.title);
            setContent(nextDoc.content);
            setEditing(false);
            if (searchParams.has('edit')) router.replace(`/${teamId}/docs/${docId}`);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }, [content, doc, docId, editorReady, router, searchParams, setDoc, teamId, title]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editing) {
                event.preventDefault();
                void handleSave();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editing, handleSave]);

    useEffect(() => {
        if (!dirty) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        const onLinkClick = (event: MouseEvent) => {
            const anchor = event.target instanceof Element ? event.target.closest('a') : null;
            if (
                !anchor ||
                anchor.target === '_blank' ||
                event.ctrlKey ||
                event.metaKey ||
                anchor.href === window.location.href
            )
                return;
            if (!window.confirm('저장하지 않은 변경 내용이 있습니다. 페이지를 떠날까요?')) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        document.addEventListener('click', onLinkClick, true);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            document.removeEventListener('click', onLinkClick, true);
        };
    }, [dirty]);

    const handleArchive = () => {
        setActionError('');
        setPendingConfirmation({ kind: 'archive' });
    };

    const handleRestoreVersion = (versionId: string) => {
        setActionError('');
        setPendingConfirmation({ kind: 'restore-version', versionId });
    };

    const handleConfirmAction = async () => {
        if (!pendingConfirmation) return;
        setConfirming(true);
        setActionError('');

        try {
            if (pendingConfirmation.kind === 'archive') {
                const response = await documentApi.archiveDocument(teamId, docId);
                if (response.success) {
                    setPendingConfirmation(null);
                    router.push(`/${teamId}/docs`);
                }
                return;
            }

            const restored = await restoreVersion(pendingConfirmation.versionId);
            if (!restored) {
                setActionError('선택한 버전을 복원하지 못했습니다.');
                return;
            }
            setDoc(restored);
            setTitle(restored.title);
            setContent(restored.content);
            setEditing(false);
            setPendingConfirmation(null);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '문서 작업에 실패했습니다.');
        } finally {
            setConfirming(false);
        }
    };

    const confirmationCopy =
        pendingConfirmation?.kind === 'restore-version'
            ? {
                  confirmLabel: '이 버전으로 복원',
                  description: '현재 문서 상태도 새 버전으로 보존되고, 선택한 버전 내용이 본문에 다시 반영됩니다.',
                  title: '이전 버전으로 복원할까요?',
                  tone: 'primary' as const,
              }
            : {
                  confirmLabel: '아카이브',
                  description: '문서는 휴지통으로 이동하며, 워크스페이스의 휴지통 화면에서 다시 복원할 수 있습니다.',
                  title: '문서를 아카이브할까요?',
                  tone: 'danger' as const,
              };

    if (!loading && (loadError || !doc))
        return (
            <div className="p-8">
                <p role="alert">{loadError || '페이지를 찾지 못했습니다.'}</p>
                <Link className="mt-4 inline-block underline" href={`/${teamId}/docs`}>
                    문서 목록으로 돌아가기
                </Link>
            </div>
        );
    if (loading || !doc) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slack-green border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="document-workspace min-h-full">
            <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border-primary bg-bg-primary px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <button
                        aria-label="페이지 탐색"
                        aria-expanded={showTree}
                        onClick={() => setShowTree(!showTree)}
                        className="rounded p-2 hover:bg-bg-hover"
                    >
                        <PanelLeft size={16} />
                    </button>
                    <nav
                        aria-label="페이지 경로"
                        className="flex min-w-0 items-center gap-2 text-xs text-text-secondary"
                    >
                        <Link href={`/${teamId}/docs`}>문서</Link>
                        {getDocumentAncestors(documents, docId).map((parent) => (
                            <span key={parent.id} className="hidden min-w-0 items-center gap-2 sm:flex">
                                <span>/</span>
                                <Link
                                    className="max-w-24 truncate hover:underline"
                                    href={`/${teamId}/docs/${parent.id}`}
                                >
                                    {parent.title}
                                </Link>
                            </span>
                        ))}
                        <span>/</span>
                        <span className="max-w-40 truncate" aria-current="page">
                            {doc.title}
                        </span>
                    </nav>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                    <button
                        aria-label="전체 너비"
                        aria-pressed={fullWidth}
                        onClick={() => setFullWidth(!fullWidth)}
                        className="rounded p-2 hover:bg-bg-hover"
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button
                        aria-label="댓글"
                        aria-expanded={panel === 'comments'}
                        onClick={() => setPanel(panel === 'comments' ? null : 'comments')}
                        className="rounded p-2 hover:bg-bg-hover"
                    >
                        <MessageSquare size={16} />
                    </button>
                    <button
                        aria-label="버전 히스토리"
                        aria-expanded={panel === 'history'}
                        onClick={() => setPanel(panel === 'history' ? null : 'history')}
                        className="rounded p-2 hover:bg-bg-hover"
                    >
                        <History size={16} />
                    </button>
                    <DocumentDetailHeader
                        doc={doc}
                        editing={editing}
                        onArchive={handleArchive}
                        saving={saving}
                        editorReady={editorReady}
                        dirty={dirty}
                        onCancel={() => {
                            if (!dirty || window.confirm('변경 내용을 취소할까요?')) {
                                setEditing(false);
                                setTitle(doc.title);
                                setContent(doc.content);
                            }
                        }}
                        onEdit={() => {
                            setEditorReady(false);
                            setEditing(true);
                        }}
                        onSave={handleSave}
                    />
                </div>
            </header>
            <div className="flex flex-col xl:flex-row">
                {showTree && (
                    <aside
                        aria-label="문서 탐색"
                        className="max-h-80 shrink-0 overflow-auto border-b border-border-primary bg-bg-secondary p-3 xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:w-60 xl:border-b-0 xl:border-r"
                    >
                        <DocumentTree documents={documents} teamId={teamId} />
                    </aside>
                )}
                <article
                    className={`mx-auto min-w-0 flex-1 px-6 pb-24 pt-12 sm:px-12 ${fullWidth ? 'max-w-none' : 'max-w-3xl'}`}
                >
                    <div className="mb-8">
                        {editing ? (
                            <input
                                aria-label="페이지 제목"
                                placeholder="제목 없음"
                                disabled={saving}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                className="w-full border-0 bg-transparent text-4xl font-bold leading-tight text-text-primary outline-none placeholder:text-text-tertiary"
                            />
                        ) : (
                            <h1 className="break-words text-4xl font-bold leading-tight text-text-primary">
                                {doc.title}
                            </h1>
                        )}
                        <p className="mt-3 text-xs text-text-tertiary">
                            마지막 수정 {new Date(doc.updatedAt).toLocaleString('ko-KR')}
                        </p>
                        {doc.externalUrl && (
                            <a
                                href={doc.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs underline"
                            >
                                Confluence 원본 열기
                            </a>
                        )}
                    </div>
                    {actionError ? (
                        <div
                            role="alert"
                            className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        >
                            {actionError}
                        </div>
                    ) : null}
                    {editing ? (
                        <div inert={saving}>
                            <DocumentEditorPanel
                                contentFormat={doc.contentFormat ?? 'plain'}
                                documentId={docId}
                                initialContent={doc.content}
                                onChange={(value) => {
                                    setContent(value);
                                    setEditorReady(true);
                                }}
                                syncKey={`${doc.id}:${doc.updatedAt}`}
                                teamId={teamId}
                            />
                        </div>
                    ) : (
                        <div className="min-h-48">
                            <DocumentContent
                                doc={doc}
                                onQuoteSelection={(quote) => {
                                    setSelectedQuote(quote);
                                    if (quote) setPanel('comments');
                                }}
                            />
                        </div>
                    )}
                    <DocumentChildrenPanel teamId={teamId} children={children} />
                </article>
                {panel && (
                    <aside
                        aria-label={panel === 'comments' ? '페이지 댓글' : '페이지 이력'}
                        className="w-full shrink-0 border-t border-border-primary p-4 xl:w-80 xl:border-l xl:border-t-0"
                    >
                        <button onClick={() => setPanel(null)} className="text-xs text-text-secondary hover:underline">
                            패널 닫기
                        </button>
                        {panel === 'comments' && (
                            <DocumentCommentPanel
                                canComment={workspace.canWrite}
                                currentUserId={workspace.currentUserId}
                                doc={doc}
                                documentId={docId}
                                members={workspace.members}
                                onClearSelectedQuote={() => setSelectedQuote(null)}
                                selectedQuote={selectedQuote}
                                teamId={teamId}
                            />
                        )}
                        {panel === 'history' && (
                            <DocumentVersionPanel
                                loading={versionLoading}
                                onRestore={handleRestoreVersion}
                                versions={versions}
                            />
                        )}
                    </aside>
                )}
            </div>
            <ConfirmationDialog
                busy={confirming}
                confirmLabel={confirmationCopy.confirmLabel}
                description={confirmationCopy.description}
                onClose={() => !confirming && setPendingConfirmation(null)}
                onConfirm={handleConfirmAction}
                open={Boolean(pendingConfirmation)}
                title={confirmationCopy.title}
                tone={confirmationCopy.tone}
            />
        </div>
    );
}
