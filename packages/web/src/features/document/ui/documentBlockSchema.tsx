'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { DatabaseWorkspace } from '@/src/features/database/ui/DatabaseWorkspace';
import { creationRequestId } from '@/src/features/database/model/creationRequestId';
import { databaseApi, databaseContainerApi } from '@/lib/api-client';
import type { KnowledgeDatabase } from '@/src/features/database/model/types';

function DatabaseSetup({
    teamId,
    parentDocumentId,
    onSelect,
}: {
    teamId: string;
    parentDocumentId?: string;
    onSelect: (id: string) => void;
}) {
    const creation = useRef<{ key: string; id: string } | null>(null);
    const [name, setName] = useState('새 데이터베이스');
    const [items, setItems] = useState<KnowledgeDatabase[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const run = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (e) {
            setError(e instanceof Error ? e.message : '데이터베이스를 불러오지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            aria-label="본문 데이터베이스 만들기"
            className="rounded-panel border border-border-primary p-4 space-y-3"
        >
            <p className="font-medium">데이터베이스</p>
            <p className="text-xs text-text-secondary">이 페이지 안에서 문서와 속성을 관리하세요.</p>
            <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                        const result = await databaseContainerApi.create(
                            teamId,
                            name.trim(),
                            creationRequestId(creation, name.trim()),
                            parentDocumentId,
                        );
                        if (!result.data) throw new Error('생성하지 못했습니다. 다시 시도하세요.');
                        creation.current = null;
                        onSelect(result.data.id);
                    });
                }}
            >
                <input
                    aria-label="본문 데이터베이스 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    className="rounded-control border border-border-primary bg-bg-secondary px-3 py-2 text-sm"
                />
                <button
                    disabled={busy || !name.trim()}
                    className="rounded-control bg-action px-3 py-2 text-sm text-white"
                >
                    새 데이터베이스
                </button>
                <button
                    type="button"
                    disabled={busy}
                    className="rounded-control border border-border-primary px-3 py-2 text-sm"
                    onClick={() =>
                        void run(async () => {
                            const result = await databaseApi.list(teamId);
                            if (!result.success) throw new Error('목록을 불러오지 못했습니다.');
                            setItems(result.data ?? []);
                        })
                    }
                >
                    기존 데이터베이스 연결
                </button>
            </form>
            {items && (
                <div className="space-y-1">
                    {items.length === 0 && <p>연결할 데이터베이스가 없습니다.</p>}
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded-control p-2 text-left hover:bg-bg-hover"
                            onClick={() => onSelect(item.id)}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
            {error && (
                <p role="alert" className="text-sm text-error">
                    {error}
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
        { type: 'database', propSchema: { databaseId: { default: '' }, viewState: { default: '' } }, content: 'none' },
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
