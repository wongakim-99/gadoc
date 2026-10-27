'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { MessageSquare, History, Maximize2 } from 'lucide-react';
import { documentApi, unwrapApiData } from '@/lib/api-client';
import type { DocumentFull, DocumentNode } from '@/src/entities/document/types';
import { getDocumentAncestors } from '@/src/entities/document/lib/getDocumentAncestors';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { useDocumentAutosave } from '../model/useDocumentAutosave';
import { useDocumentVersions } from '../model/useDocumentVersions';
import { DocumentDetailHeader } from './DocumentDetailHeader';
import { DocumentChildrenPanel } from './DocumentChildrenPanel';
import { DocumentCommentPanel } from './DocumentCommentPanel';
import { DocumentVersionPanel } from './DocumentVersionPanel';
import type { CollaborationState } from '../model/DocumentCollaborationProvider';
import { ConfirmationDialog } from '@/src/shared/ui/ConfirmationDialog';
import { WorkspaceReferenceActions } from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import { DocumentDatabaseProperties } from '@/src/features/database/ui/DocumentDatabaseProperties';
import { RelatedIssues } from '@/src/features/issue/ui/RelatedIssues';

const DocumentEditorPanel = dynamic(() => import('./DocumentEditorPanel').then((m) => m.DocumentEditorPanel), {
    ssr: false,
});

export function DocumentWorkspace({
    doc,
    documents,
    children,
    onRestore,
}: {
    doc: DocumentFull;
    documents: DocumentNode[];
    children: DocumentNode[];
    onRestore: (doc: DocumentFull) => void;
}) {
    const router = useRouter();
    const autosave = useDocumentAutosave(doc, true);
    const [collaboration, setCollaboration] = useState<CollaborationState | null>(null);
    const flushLive = useRef<() => Promise<boolean>>(async () => true);
    const flush = async () => (await flushLive.current()) && (await autosave.flush());
    const saveStatus =
        collaboration?.status === 'error' || autosave.status === 'error'
            ? 'error'
            : collaboration?.status === 'saving' || autosave.status === 'saving'
              ? 'saving'
              : collaboration?.status === 'pending' || autosave.status === 'pending'
                ? 'pending'
                : 'saved';
    const workspace = useTeamWorkspaceData(doc.teamId);
    const [panel, setPanel] = useState<'comments' | 'history' | null>(null);
    const [fullWidth, setFullWidth] = useState(false);
    const [ready, setReady] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [creatingChild, setCreatingChild] = useState(false);
    const creatingChildRef = useRef(false);
    const [pending, setPending] = useState<{ kind: 'archive' } | { kind: 'restore'; id: string } | null>(null);
    const titleInput = useRef<HTMLTextAreaElement>(null);
    const editorContainer = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (autosave.status === 'saved') {
            setActionError((current) => (current.startsWith('하위 페이지는 생성됐지만') ? '' : current));
        }
    }, [autosave.status]);
    useEffect(() => {
        if (ready && new URLSearchParams(window.location.search).get('new') === '1') {
            titleInput.current?.focus();
            titleInput.current?.select();
        }
    }, [ready]);
    useEffect(() => {
        const input = titleInput.current;
        if (!input) return;
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }, [autosave.title, fullWidth]);
    const versions = useDocumentVersions(doc.teamId, doc.id);
    useEffect(() => {
        if (panel === 'history') void versions.refresh();
    }, [panel, autosave.updatedAt, versions.refresh]);

    const confirm = async () => {
        if (!pending) return;
        setConfirming(true);
        setActionError('');
        try {
            if (ready && doc.canEdit !== false && !(await flush())) return;
            if (pending.kind === 'archive') {
                const response = await documentApi.archiveDocument(doc.teamId, doc.id);
                if (!response.success) throw new Error('페이지를 아카이브하지 못했습니다.');
                window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));
                router.push(`/${doc.teamId}/docs`);
            } else {
                const restored = await versions.restoreVersion(pending.id);
                if (!restored) throw new Error('버전을 복원하지 못했습니다.');
                window.dispatchEvent(new CustomEvent('slacord:document-updated', { detail: restored }));
                onRestore(restored);
            }
            setPending(null);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '작업에 실패했습니다.');
        } finally {
            setConfirming(false);
        }
    };
    const button =
        'rounded p-2 text-text-secondary hover:bg-bg-hover aria-expanded:bg-bg-hover aria-pressed:bg-bg-hover';

    const createChild = async (insertLink?: (child: { id: string; title: string }) => void) => {
        if (!ready || !workspace.canWrite || doc.canEdit === false || creatingChildRef.current) return;
        creatingChildRef.current = true;
        setCreatingChild(true);
        setActionError('');
        try {
            if (!(await flush())) return;
            const response = await documentApi.createDocument(doc.teamId, {
                title: '제목 없음',
                parentId: doc.id,
                content: '[]',
                contentFormat: 'json',
            });
            const child = unwrapApiData<DocumentFull>(response);
            if (!response.success || !child?.id) throw new Error('하위 페이지를 만들지 못했습니다.');
            window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));
            if (insertLink) {
                insertLink(child);
                if (!(await flush())) {
                    setActionError(
                        '하위 페이지는 생성됐지만 본문 링크 저장에 실패했습니다. 저장을 재시도한 뒤 하위 페이지를 열어 주세요.',
                    );
                    return;
                }
            }
            router.push(`/${doc.teamId}/docs/${child.id}?new=1`);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '하위 페이지 생성 실패');
        } finally {
            creatingChildRef.current = false;
            setCreatingChild(false);
        }
    };

    return (
        <div className="document-workspace min-h-[calc(100dvh-3rem)] lg:min-h-full">
            <header className="workspace-topbar sticky top-0 z-20 flex-wrap">
                <nav
                    aria-label="페이지 경로"
                    className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-text-secondary"
                >
                    <Link href={`/${doc.teamId}/docs`}>문서</Link>
                    {getDocumentAncestors(documents, doc.id).map((parent) => (
                        <span key={parent.id} className="flex shrink-0 items-center gap-2">
                            <span>/</span>
                            <Link
                                className="max-w-28 truncate hover:underline"
                                href={`/${doc.teamId}/docs/${parent.id}`}
                            >
                                {parent.title}
                            </Link>
                        </span>
                    ))}
                    <span>/</span>
                    <span className="max-w-44 truncate" aria-current="page">
                        {autosave.title || '제목 없음'}
                    </span>
                </nav>
                <div className="flex flex-wrap items-center gap-1">
                    <WorkspaceReferenceActions
                        reference={{
                            kind: 'docs',
                            href: `/${doc.teamId}/docs/${doc.id}`,
                            label: autosave.title || '문서',
                        }}
                    />
                    <button
                        aria-label="전체 너비"
                        aria-pressed={fullWidth}
                        onClick={() => setFullWidth(!fullWidth)}
                        className={button}
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button
                        aria-label="댓글"
                        aria-expanded={panel === 'comments'}
                        onClick={() => setPanel(panel === 'comments' ? null : 'comments')}
                        className={button}
                    >
                        <MessageSquare size={16} />
                    </button>
                    <button
                        aria-label="버전 히스토리"
                        aria-expanded={panel === 'history'}
                        onClick={() => setPanel(panel === 'history' ? null : 'history')}
                        className={button}
                    >
                        <History size={16} />
                    </button>
                    <DocumentDetailHeader
                        doc={doc}
                        status={saveStatus}
                        onRetry={() => void flush()}
                        onArchive={() => setPending({ kind: 'archive' })}
                    />
                </div>
            </header>
            <div className="flex flex-col xl:flex-row">
                <article
                    className={`mx-auto min-w-0 flex-1 px-6 pb-24 pt-10 sm:px-12 sm:pt-14 ${fullWidth ? 'max-w-none' : 'max-w-[880px]'}`}
                    inert={confirming || creatingChild}
                    onCompositionStart={() => autosave.setComposing(true)}
                    onCompositionEnd={() => autosave.setComposing(false)}
                >
                    <div className="mb-8">
                        {doc.canEdit !== false ? (
                            <textarea
                                ref={titleInput}
                                rows={1}
                                aria-label="페이지 제목"
                                placeholder="제목 없음"
                                value={autosave.title}
                                disabled={!ready || !collaboration?.canEdit}
                                onChange={(event) => autosave.changeTitle(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                        event.preventDefault();
                                        editorContainer.current
                                            ?.querySelector<HTMLElement>('[contenteditable="true"]')
                                            ?.focus();
                                    }
                                }}
                                className="document-title w-full resize-none overflow-hidden border-0 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
                            />
                        ) : (
                            <h1 className="document-title break-words text-text-primary">{autosave.title}</h1>
                        )}
                        <p className="mt-3 text-xs text-text-tertiary">
                            마지막 수정 {new Date(autosave.updatedAt).toLocaleString('ko-KR')}
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
                    <DocumentDatabaseProperties
                        key={doc.id}
                        teamId={doc.teamId}
                        documentId={doc.id}
                        members={workspace.members}
                    />
                    {(autosave.error || actionError) && (
                        <p
                            role="alert"
                            className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        >
                            {actionError || autosave.error} 작성한 내용은 이 페이지에 유지됩니다.
                        </p>
                    )}
                    <div ref={editorContainer} data-testid="document-content">
                        <DocumentEditorPanel
                            contentFormat={doc.contentFormat ?? 'plain'}
                            documentId={doc.id}
                            initialContent={doc.content}
                            onReady={(content) => {
                                autosave.onReady(content);
                                setReady(true);
                            }}
                            onChange={autosave.changeContent}
                            onCollaboration={(state, save) => {
                                setCollaboration(state);
                                flushLive.current = save;
                                autosave.receiveRemote(state.title, state.updatedAt);
                            }}
                            onCreateChild={workspace.canWrite ? createChild : undefined}
                            onQuoteSelection={setSelectedQuote}
                            syncKey={doc.id}
                            teamId={doc.teamId}
                        />
                    </div>
                    <RelatedIssues
                        teamId={doc.teamId}
                        kind="document"
                        resourceId={doc.id}
                        canWrite={workspace.canWrite}
                    />
                    <DocumentChildrenPanel
                        teamId={doc.teamId}
                        children={children}
                        onCreate={workspace.canWrite && doc.canEdit !== false ? () => void createChild() : undefined}
                        creating={creatingChild || !ready}
                    />
                </article>
                {panel && (
                    <aside
                        aria-label={panel === 'comments' ? '페이지 댓글' : '페이지 이력'}
                        className="w-full shrink-0 border-t border-border-primary p-4 xl:w-80 xl:border-l xl:border-t-0"
                    >
                        <button onClick={() => setPanel(null)} className="text-xs text-text-secondary hover:underline">
                            패널 닫기
                        </button>
                        {panel === 'comments' ? (
                            <DocumentCommentPanel
                                canComment={workspace.canWrite}
                                currentUserId={workspace.currentUserId}
                                doc={doc}
                                documentId={doc.id}
                                members={workspace.members}
                                onClearSelectedQuote={() => setSelectedQuote(null)}
                                selectedQuote={selectedQuote}
                                teamId={doc.teamId}
                            />
                        ) : (
                            <DocumentVersionPanel
                                loading={versions.loading}
                                onRestore={(id) => setPending({ kind: 'restore', id })}
                                versions={versions.versions}
                                canRestore={doc.canEdit !== false}
                            />
                        )}
                    </aside>
                )}
            </div>
            <ConfirmationDialog
                busy={confirming}
                open={!!pending}
                onClose={() => !confirming && setPending(null)}
                onConfirm={confirm}
                title={pending?.kind === 'restore' ? '이전 버전으로 복원할까요?' : '문서를 아카이브할까요?'}
                description={
                    pending?.kind === 'restore'
                        ? '현재 변경을 저장한 뒤 선택한 버전을 복원합니다.'
                        : '현재 변경을 저장한 뒤 휴지통으로 이동합니다.'
                }
                confirmLabel={pending?.kind === 'restore' ? '복원' : '아카이브'}
                tone={pending?.kind === 'restore' ? 'primary' : 'danger'}
            />
        </div>
    );
}
