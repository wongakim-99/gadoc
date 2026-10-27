'use client';

import { useEffect, useRef, useState } from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
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
    onQuoteSelection,
    syncKey,
    teamId,
}: Props) {
    const onChangeRef = useRef(onChange);
    const [loadError, setLoadError] = useState('');
    const initialized = useRef(false);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
    const dropTarget = useRef<HTMLElement | null>(null);

    const editor = useCreateBlockNote(
        {
            dictionary: ko,
            initialContent: [{ type: 'paragraph' }],
            uploadFile: async (file) => {
                const url = unwrapApiData<{ url: string }>(
                    await documentApi.uploadDocumentFile(teamId, documentId, file),
                )?.url;
                if (!url) throw new Error('이미지 업로드에 실패했습니다.');
                return url;
            },
        },
        [teamId, documentId],
    );

    useEffect(() => {
        initialized.current = false;
        setLoadError('');
        try {
            syncEditor(editor, initialContent, contentFormat);
            initialized.current = true;
            onReadyRef.current(JSON.stringify(editor.document));
        } catch {
            setLoadError('본문을 편집기로 불러오지 못했습니다. 원본은 변경하지 않았습니다. 버전 이력을 확인해 주세요.');
        }
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
                />
            </WorkspaceReferenceDropZone>
        </div>
    );
}

function syncEditor(editor: BlockNoteEditor, content: string, contentFormat: 'plain' | 'html' | 'json') {
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
