'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { DatabaseWorkspace } from '@/src/features/database/ui/DatabaseWorkspace';
import { databaseApi, databaseContainerApi } from '@/lib/api-client';
import type { KnowledgeDatabase } from '@/src/features/database/model/types';

function DatabaseSetup({
    teamId,
    parentDocumentId,
    blockId,
    linked,
    onSelect,
}: {
    teamId: string;
    parentDocumentId?: string;
    blockId: string;
    linked: boolean;
    onSelect: (id: string) => void;
}) {
    const [items, setItems] = useState<KnowledgeDatabase[] | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const select = useRef(onSelect);
    select.current = onSelect;
    useEffect(() => {
        let active = true;
        setError('');
        const load = async () => {
            try {
                if (linked) {
                    const result = await databaseApi.list(teamId);
                    if (!result.success) throw new Error('목록을 불러오지 못했습니다.');
                    if (active) setItems(result.data ?? []);
                } else {
                    // Stable across StrictMode, reloads and ambiguous network failures.
                    const hash = await crypto.subtle.digest(
                        'SHA-256',
                        new TextEncoder().encode(JSON.stringify([teamId, parentDocumentId, blockId])),
                    );
                    const requestId = Array.from(new Uint8Array(hash).slice(0, 12), (byte) =>
                        byte.toString(16).padStart(2, '0'),
                    ).join('');
                    if (!active) return;
                    const result = await databaseContainerApi.create(
                        teamId,
                        '새 데이터베이스',
                        requestId,
                        parentDocumentId,
                    );
                    if (!result.data) throw new Error('데이터베이스를 생성하지 못했습니다.');
                    if (active) {
                        select.current(result.data.id);
                        window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));
                    }
                }
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : '데이터베이스를 불러오지 못했습니다.');
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [teamId, parentDocumentId, blockId, linked, attempt]);
    return (
        <section aria-label={linked ? '데이터베이스 연결' : '데이터베이스 생성'} className="py-3">
            {error ? (
                <div role="alert" className="text-sm text-error">
                    {error}
                    <button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-2 underline">
                        다시 시도
                    </button>
                </div>
            ) : linked && items ? (
                <div className="max-h-64 overflow-auto rounded-control border border-border-primary">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-bg-hover"
                            onClick={() => onSelect(item.id)}
                        >
                            {item.name}
                        </button>
                    ))}
                    {!items.length && (
                        <p className="p-3 text-sm text-text-secondary">연결할 데이터베이스가 없습니다.</p>
                    )}
                </div>
            ) : (
                <p role="status" className="text-sm text-text-tertiary">
                    {linked ? '불러오는 중…' : '생성 중…'}
                </p>
            )}
        </section>
    );
}

function DatabaseBlockBoundary({ id, children }: { id: string; children: ReactNode }) {
    const container = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = container.current;
        // BlockNote's plain-table handles inspect native mouse events and assume
        // every HTML table belongs to a table block. Database tables are isolated.
        const stop = (event: MouseEvent) => event.stopPropagation();
        element?.addEventListener('mousemove', stop);
        element?.addEventListener('mouseup', stop);
        return () => {
            element?.removeEventListener('mousemove', stop);
            element?.removeEventListener('mouseup', stop);
        };
    }, []);
    return (
        <div ref={container} contentEditable={false} className="w-full min-w-0" data-inline-database={id || 'new'}>
            {children}
        </div>
    );
}

export function createDocumentSchema(teamId: string, documentId?: string) {
    const database = createReactBlockSpec(
        {
            type: 'database',
            propSchema: { databaseId: { default: '' }, viewState: { default: '' }, linked: { default: false } },
            content: 'none',
        },
        {
            render: ({ block, editor }) => (
                <DatabaseBlockBoundary id={block.props.databaseId}>
                    {block.props.databaseId ? (
                        <DatabaseWorkspace
                            teamId={teamId}
                            databaseId={block.props.databaseId}
                            inline
                            inlineState={block.props.viewState}
                            onInlineStateChange={
                                editor.isEditable
                                    ? (state) => editor.updateBlock(block, { props: { viewState: state } })
                                    : undefined
                            }
                        />
                    ) : editor.isEditable ? (
                        <DatabaseSetup
                            parentDocumentId={documentId}
                            blockId={block.id}
                            linked={block.props.linked}
                            teamId={teamId}
                            onSelect={(id) => editor.updateBlock(block, { props: { databaseId: id } })}
                        />
                    ) : (
                        <p>아직 연결되지 않은 데이터베이스입니다.</p>
                    )}
                </DatabaseBlockBoundary>
            ),
            toExternalHTML: ({ block }) => (
                <a href={`/${teamId}/docs?database=${block.props.databaseId}`}>데이터베이스 열기</a>
            ),
        },
    );
    return BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, database: database() } });
}

export type DocumentBlockEditor = ReturnType<typeof createDocumentSchema>['BlockNoteEditor'];
