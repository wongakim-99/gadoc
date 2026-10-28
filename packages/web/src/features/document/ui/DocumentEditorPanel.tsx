'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createDocumentSchema } from './documentBlockSchema';
import { useDocumentCollaboration } from '../model/useDocumentCollaboration';
import type { CollaborationState, DocumentCollaborationProvider } from '../model/DocumentCollaborationProvider';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import { Database, FilePlus2 } from 'lucide-react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { ko } from '@blocknote/core/locales';
import { documentApi, unwrapApiData } from '@/lib/api-client';
import { DocumentAttachmentButton } from './DocumentAttachmentButton';
import { InsertWorkspaceReference } from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import { WorkspaceReferenceDropZone } from '@/src/features/workspace/ui/WorkspaceReferenceDropZone';
import type { WorkspaceReference } from '@/src/features/workspace/model/workspaceReference';

interface Props {
    contentFormat: 'plain' | 'html' | 'json';
    documentId: string;
    initialContent: string;
    onChange: (content: string) => void;
    onReady: (content: string) => void;
    onCreateChild?: (insertLink: (child: { id: string; title: string }) => void) => Promise<void>;
    onQuoteSelection?: (quote: string | null) => void;
    syncKey: string;
    teamId: string;
    onCollaboration?: (state: CollaborationState, flush: () => Promise<boolean>) => void;
}

export function DocumentEditorPanel(props: Props) {
    const { provider, state } = useDocumentCollaboration(props.teamId, props.documentId);
    const notify = useRef(props.onCollaboration);
    notify.current = props.onCollaboration;
    useEffect(() => {
        if (state && provider) notify.current?.(state, () => provider.flush());
    }, [state, provider]);
    return (
        <div className="space-y-3">
            {state?.error && (
                <div
                    role="alert"
                    className="rounded-control border border-amber-400/30 px-3 py-2 text-sm text-text-secondary"
                >
                    {state.error}{' '}
                    <button
                        className="ml-2 underline"
                        onClick={() => {
                            provider?.reconnect();
                            void provider?.flush();
                        }}
                    >
                        다시 연결
                    </button>
                </div>
            )}
            {provider && state?.ready ? (
                <>
                    <div
                        aria-label="공동 편집 참여자"
                        className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"
                    >
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        />
                        <span>{state.connected ? '실시간 연결됨' : '재연결 중'}</span>
                        {state.peers.map((peer) => (
                            <span
                                key={peer.id}
                                className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-1"
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: peer.color }} />
                                {peer.name}
                                {peer.editing ? ' · 편집 중' : ''}
                            </span>
                        ))}
                    </div>
                    <LiveDocumentEditor {...props} provider={provider} canEdit={state.canEdit} />
                </>
            ) : (
                <p role="status" className="py-6 text-sm text-text-secondary">
                    문서를 연결하고 있습니다.
                </p>
            )}
        </div>
    );
}

function LiveDocumentEditor({
    documentId,
    onChange,
    onReady,
    onCreateChild,
    onQuoteSelection,
    teamId,
    provider,
    canEdit,
}: Props & { provider: DocumentCollaborationProvider; canEdit: boolean }) {
    const onChangeRef = useRef(onChange);
    const initialized = useRef(false);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
    const dropTarget = useRef<HTMLElement | null>(null);

    const schema = useMemo(() => createDocumentSchema(teamId, documentId), [teamId, documentId]);
    const editor = useCreateBlockNote(
        {
            schema,
            dictionary: ko,
            collaboration: {
                fragment: provider.doc.getXmlFragment('document-store'),
                provider,
                user: provider.user,
                showCursorLabels: 'activity',
            },
            uploadFile: async (file) => {
                const url = unwrapApiData<{ url: string }>(
                    await documentApi.uploadDocumentFile(teamId, documentId, file),
                )?.url;
                if (!url) throw new Error('이미지 업로드에 실패했습니다.');
                return url;
            },
        },
        [teamId, documentId, provider],
    );

    useEffect(() => {
        initialized.current = true;
        onReadyRef.current(JSON.stringify(editor.document));
    }, [editor]);

    const markDropTarget = (target: EventTarget | null) => {
        dropTarget.current?.removeAttribute('data-reference-drop-target');
        const block = target instanceof Element ? target.closest<HTMLElement>('[data-id]') : null;
        dropTarget.current = block;
        block?.setAttribute('data-reference-drop-target', 'true');
    };
    useEffect(
        () => () => {
            dropTarget.current?.removeAttribute('data-reference-drop-target');
        },
        [],
    );
    const insertReference = (reference: WorkspaceReference, target?: EventTarget | null) => {
        if (!canEdit) return;
        const id = target instanceof Element ? target.closest<HTMLElement>('[data-id]')?.dataset.id : undefined;
        const block =
            target === undefined
                ? editor.getTextCursorPosition().block
                : ((id ? editor.getBlock(id) : undefined) ?? editor.document[editor.document.length - 1]);
        editor.insertBlocks(
            [{ type: 'paragraph', content: [{ type: 'link', href: reference.href, content: reference.label }] }],
            block,
            'after',
        );
        onChangeRef.current(JSON.stringify(editor.document));
    };

    return (
        <div className="space-y-3">
            {canEdit && <InsertWorkspaceReference onInsert={(reference) => insertReference(reference)} />}
            {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <DocumentAttachmentButton
                        documentId={documentId}
                        editor={editor}
                        onUploaded={() => onChangeRef.current(JSON.stringify(editor.document))}
                        teamId={teamId}
                    />
                </div>
            )}
            <WorkspaceReferenceDropZone
                label="놓은 문단 아래에 참조 추가"
                onHover={markDropTarget}
                onInsert={(reference, _, event) => insertReference(reference, event.target)}
            >
                <BlockNoteView
                    slashMenu={false}
                    editor={editor}
                    editable={canEdit}
                    className="slacord-blocknote"
                    theme="dark"
                    onSelectionChange={() => {
                        const quote = editor.getSelectedText().replace(/\s+/g, ' ').trim().slice(0, 280);
                        if (quote) onQuoteSelection?.(quote);
                    }}
                    onChange={() => {
                        if (initialized.current) onChangeRef.current(JSON.stringify(editor.document));
                    }}
                >
                    {canEdit && (
                        <SuggestionMenuController
                            triggerCharacter="/"
                            getItems={async (query) =>
                                filterSuggestionItems(
                                    [
                                        {
                                            title: '데이터베이스',
                                            subtext: '빈 데이터베이스 추가',
                                            aliases: [
                                                'database',
                                                'db',
                                                '데이터베이스',
                                                '데이터',
                                                '디비',
                                                '인라인',
                                                '표',
                                                'wbs',
                                                '일정',
                                            ],
                                            group: '데이터 관리',
                                            icon: <Database size={18} />,
                                            onItemClick: () => {
                                                const current = editor.getTextCursorPosition().block;
                                                if (current.type === 'paragraph' && current.content.length === 0) {
                                                    editor.updateBlock(current, {
                                                        type: 'database',
                                                        props: { databaseId: '' },
                                                    });
                                                } else {
                                                    editor.insertBlocks([{ type: 'database' }], current, 'after');
                                                }
                                            },
                                        },
                                        {
                                            title: '데이터베이스 연결',
                                            subtext: '기존 데이터베이스의 보기 추가',
                                            aliases: ['linked database', '연결된 데이터베이스'],
                                            group: '데이터 관리',
                                            icon: <Database size={18} />,
                                            onItemClick: () => {
                                                const current = editor.getTextCursorPosition().block;
                                                if (current.type === 'paragraph' && current.content.length === 0)
                                                    editor.updateBlock(current, {
                                                        type: 'database',
                                                        props: { linked: true },
                                                    });
                                                else
                                                    editor.insertBlocks(
                                                        [{ type: 'database', props: { linked: true } }],
                                                        current,
                                                        'after',
                                                    );
                                            },
                                        },
                                        ...getDefaultReactSlashMenuItems(editor),
                                        ...(onCreateChild
                                            ? [
                                                  {
                                                      title: '페이지',
                                                      subtext: '이 문서 아래에 새 페이지를 만들고 열기',
                                                      aliases: ['page', 'subpage', '하위페이지', '하위 페이지', '문서'],
                                                      group: '문서 생성',
                                                      icon: <FilePlus2 size={18} />,
                                                      onItemClick: () => {
                                                          const blockId = editor.getTextCursorPosition().block.id;
                                                          void onCreateChild((child) => {
                                                              const block = editor.getBlock(blockId);
                                                              const content = [
                                                                  {
                                                                      type: 'link' as const,
                                                                      href: `/${teamId}/docs/${child.id}`,
                                                                      content: child.title,
                                                                  },
                                                              ];
                                                              if (
                                                                  block?.type === 'paragraph' &&
                                                                  Array.isArray(block.content) &&
                                                                  block.content.length === 0
                                                              ) {
                                                                  editor.updateBlock(blockId, { content });
                                                              } else {
                                                                  editor.insertBlocks(
                                                                      [{ type: 'paragraph', content }],
                                                                      block ??
                                                                          editor.document[editor.document.length - 1],
                                                                      'after',
                                                                  );
                                                              }
                                                              onChangeRef.current(JSON.stringify(editor.document));
                                                          });
                                                      },
                                                  },
                                              ]
                                            : []),
                                    ],
                                    query,
                                )
                            }
                        />
                    )}
                </BlockNoteView>
            </WorkspaceReferenceDropZone>
        </div>
    );
}
