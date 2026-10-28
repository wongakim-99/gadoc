'use client';

import { useState, type MouseEvent } from 'react';
import { Columns2, Columns3, FileText, LayoutTemplate } from 'lucide-react';
import { createDocumentColumns, createDocumentHubTemplate } from '@slacord/document-core';
import type { DocumentBlockEditor } from './documentBlockSchema';
import { DocumentLinkPicker } from './DocumentLinkPicker';

export function useDocumentLayoutTools(editor: DocumentBlockEditor, teamId: string, documentId: string) {
    const [pickerAnchor, setPickerAnchor] = useState<string | null>(null);
    const [error, setError] = useState('');
    const currentAnchor = () => {
        // Native selectionchange may still be queued when a toolbar action starts.
        const node = window.getSelection()?.anchorNode;
        const element = node instanceof Element ? node : node?.parentElement;
        const id =
            element && editor.domElement?.contains(element)
                ? element.closest<HTMLElement>('[data-id]')?.dataset.id
                : undefined;
        return (id ? editor.getBlock(id) : undefined) ?? editor.getTextCursorPosition().block;
    };
    const insert = (blocks: Parameters<DocumentBlockEditor['insertBlocks']>[0], anchorId?: string) => {
        if (!editor.isEditable) return;
        setError('');
        try {
            const anchor = anchorId ? editor.getBlock(anchorId) : currentAnchor();
            if (!anchor) throw new Error('선택한 문단이 변경됐습니다. 삽입할 위치를 다시 선택해 주세요.');
            const inserted = editor.insertBlocks(blocks, anchor, 'after');
            let first = inserted[0];
            while (first.children.length) first = first.children[0];
            editor.setTextCursorPosition(first, 'start');
            requestAnimationFrame(() => editor.focus());
            setPickerAnchor(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '배치를 추가하지 못했습니다.');
        }
    };
    const items = [
        {
            title: '문서 링크',
            subtext: '기존 문서를 찾아 현재 위치에 연결',
            aliases: ['링크', 'link', '연결', '문서 연결'],
            group: '페이지 구성',
            icon: <FileText size={17} />,
            onItemClick: () => {
                setError('');
                setPickerAnchor(currentAnchor().id);
            },
        },
        {
            title: '2열 배치',
            subtext: '두 섹션을 나란히 배치',
            aliases: ['2열', '2 columns', 'columns', '열', '배치'],
            group: '페이지 구성',
            icon: <Columns2 size={17} />,
            onItemClick: () => insert([createDocumentColumns(2)]),
        },
        {
            title: '3열 배치',
            subtext: '세 섹션을 나란히 배치',
            aliases: ['3열', '3 columns', 'columns', '열', '배치'],
            group: '페이지 구성',
            icon: <Columns3 size={17} />,
            onItemClick: () => insert([createDocumentColumns(3)]),
        },
        {
            title: '문서 허브',
            subtext: '문서·자료·업무를 연결하는 시작 틀 추가',
            aliases: ['허브', 'hub', '템플릿', 'template'],
            group: '페이지 구성',
            icon: <LayoutTemplate size={17} />,
            onItemClick: () => insert(createDocumentHubTemplate()),
        },
    ];
    return {
        items,
        onEditorClick: (event: MouseEvent<HTMLElement>) => {
            if (!editor.isEditable || event.button !== 0 || window.getSelection()?.isCollapsed === false) return;
            const element =
                event.target instanceof Element ? event.target.closest('[data-content-type="paragraph"]') : null;
            if (!element || !editor.domElement?.contains(element)) return;
            const id = element.closest<HTMLElement>('[data-id]')?.dataset.id;
            const block = id ? editor.getBlock(id) : undefined;
            // Empty grid paragraphs have no text caret for native coordinate lookup.
            if (block?.type === 'paragraph' && block.content.length === 0) {
                editor.setTextCursorPosition(block, 'start');
                editor.focus();
            }
        },
        toolbar: (
            <>
                <div
                    aria-label="페이지 구성"
                    className="flex flex-wrap items-center gap-1 border-b border-border-primary pb-2 text-xs text-text-secondary"
                >
                    {items.map((item) => (
                        <button
                            key={item.title}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={item.onItemClick}
                            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1.5 hover:bg-bg-hover hover:text-text-primary"
                        >
                            {item.icon}
                            {item.title}
                        </button>
                    ))}
                    <span className="ml-auto hidden text-text-tertiary sm:inline">문단에서 / 로도 추가</span>
                </div>
                {error && (
                    <p role="alert" className="text-sm text-error">
                        {error}
                    </p>
                )}
                {pickerAnchor && (
                    <DocumentLinkPicker
                        key={teamId + ':' + documentId}
                        teamId={teamId}
                        documentId={documentId}
                        onClose={() => setPickerAnchor(null)}
                        onSelect={(document) =>
                            insert(
                                [
                                    {
                                        type: 'paragraph',
                                        content: [
                                            {
                                                type: 'link',
                                                href: `/${teamId}/docs/${document.id}`,
                                                content: document.title || '제목 없음',
                                            },
                                        ],
                                    },
                                ],
                                pickerAnchor,
                            )
                        }
                    />
                )}
            </>
        ),
    };
}
