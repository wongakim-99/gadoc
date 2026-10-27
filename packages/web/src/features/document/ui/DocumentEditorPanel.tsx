'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDocumentSchema, type DocumentBlockEditor } from './documentBlockSchema';
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
}

export function DocumentEditorPanel({
    contentFormat,
    documentId,
    initialContent,
    onChange,
    onReady,
    onCreateChild,
    onQuoteSelection,
    syncKey,
    teamId,
}: Props) {
    const onChangeRef = useRef(onChange);
    const [loadError, setLoadError] = useState('');
    const initialized = useRef(false);
    const loaded = useRef<{ editor: unknown; syncKey: string } | null>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
    const dropTarget = useRef<HTMLElement | null>(null);

    const schema = useMemo(() => createDocumentSchema(teamId, documentId), [teamId, documentId]);
    const editor = useCreateBlockNote(
        {
            schema,
            dictionary: ko,
            initialContent: [{ type: 'paragraph' }],
            uploadFile: async (file) => {
                const url = unwrapApiData<{ url: string }>(await documentApi.uploadDocumentImage(teamId, file))?.url;
                if (!url) throw new Error('이미지 업로드에 실패했습니다.');
                return url;
            },
        },
        [teamId],
    );

    useEffect(() => {
        if (loaded.current?.editor === editor && loaded.current.syncKey === syncKey) return;
        initialized.current = false;
        setLoadError('');
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            try {
                syncEditor(editor, initialContent, contentFormat);
                initialized.current = true;
                loaded.current = { editor, syncKey };
                onReadyRef.current(JSON.stringify(editor.document));
            } catch {
                setLoadError(
                    '본문을 편집기로 불러오지 못했습니다. 원본은 변경하지 않았습니다. 버전 이력을 확인해 주세요.',
                );
            }
        });
        return () => {
            cancelled = true;
        };
    }, [contentFormat, editor, initialContent, syncKey]);

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

    if (loadError)
        return (
            <p role="alert" className="text-sm text-red-300">
                {loadError}
            </p>
        );

    return (
        <div className="space-y-3">
            <InsertWorkspaceReference onInsert={(reference) => insertReference(reference)} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-text-tertiary">빈 줄에서 / 를 입력해 블록을 추가하세요.</p>
                <DocumentAttachmentButton
                    documentId={documentId}
                    editor={editor}
                    onUploaded={() => onChangeRef.current(JSON.stringify(editor.document))}
                    teamId={teamId}
                />
            </div>
            <WorkspaceReferenceDropZone
                label="놓은 문단 아래에 참조 추가"
                onHover={markDropTarget}
                onInsert={(reference, _, event) => insertReference(reference, event.target)}
            >
                <BlockNoteView
                    slashMenu={false}
                    editor={editor}
                    editable={!loadError}
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
                    <SuggestionMenuController
                        triggerCharacter="/"
                        getItems={async (query) =>
                            filterSuggestionItems(
                                [
                                    ...getDefaultReactSlashMenuItems(editor),
                                    {
                                        title: '데이터베이스',
                                        subtext: '페이지 안에 새 데이터베이스를 만들거나 기존 데이터베이스 연결',
                                        aliases: ['database', '데이터베이스', '인라인', '표'],
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
                                                                  block ?? editor.document[editor.document.length - 1],
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
                </BlockNoteView>
            </WorkspaceReferenceDropZone>
        </div>
    );
}

function syncEditor(editor: DocumentBlockEditor, content: string, contentFormat: 'plain' | 'html' | 'json') {
    const fallback = editor.tryParseHTMLToBlocks('<p></p>');
    if (contentFormat === 'json' && content.trim()) {
        const blocks = JSON.parse(content);
        if (!Array.isArray(blocks)) throw new Error('Invalid document blocks');
        editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : fallback);
        return;
    }
    const nextBlocks = !content.trim()
        ? fallback
        : contentFormat === 'html'
          ? editor.tryParseHTMLToBlocks(content)
          : editor.tryParseMarkdownToBlocks(content);
    editor.replaceBlocks(editor.document, nextBlocks.length > 0 ? nextBlocks : fallback);
}
