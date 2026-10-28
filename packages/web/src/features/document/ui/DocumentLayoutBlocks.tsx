'use client';

import { createReactBlockSpec } from '@blocknote/react';
import { documentColumnConfig, documentColumnsConfig } from '@slacord/document-core';
import { Columns2, Plus } from 'lucide-react';
import type { DocumentBlockEditor } from './documentBlockSchema';

export function createDocumentLayoutSpecs() {
    const columns = createReactBlockSpec(documentColumnsConfig, {
        render: ({ block, editor: blockEditor }) => {
            const editor = blockEditor as unknown as DocumentBlockEditor;
            return (
                <div className="document-layout-controls" contentEditable={false}>
                    <span>
                        <Columns2 size={13} /> {block.props.columns}열 배치
                    </span>
                    {editor.isEditable && (
                        <button
                            type="button"
                            aria-label="배치 아래에 문단 추가"
                            onClick={() => {
                                const [paragraph] = editor.insertBlocks([{ type: 'paragraph' }], block, 'after');
                                editor.setTextCursorPosition(paragraph, 'start');
                                editor.focus();
                            }}
                        >
                            <Plus size={13} /> 아래에 쓰기
                        </button>
                    )}
                </div>
            );
        },
        toExternalHTML: () => <div />,
    });
    const column = createReactBlockSpec(documentColumnConfig, {
        render: ({ block, editor: blockEditor }) => {
            const editor = blockEditor as unknown as DocumentBlockEditor;
            return (
                <div className="document-column-controls" contentEditable={false}>
                    {editor.isEditable && (
                        <button
                            type="button"
                            aria-label="이 열에 문단 추가"
                            onClick={() => {
                                const current = editor.getBlock(block.id);
                                if (!current) return;
                                const last = current.children.at(-1);
                                if (last) {
                                    const [paragraph] = editor.insertBlocks([{ type: 'paragraph' }], last, 'after');
                                    editor.setTextCursorPosition(paragraph, 'start');
                                } else {
                                    const updated = editor.updateBlock(current, { children: [{ type: 'paragraph' }] });
                                    editor.setTextCursorPosition(updated.children[0], 'start');
                                }
                                editor.focus();
                            }}
                        >
                            <Plus size={13} /> 문단
                        </button>
                    )}
                </div>
            );
        },
        toExternalHTML: () => <div />,
    });
    return { documentColumns: columns(), documentColumn: column() };
}
