'use client';
import { useState, useRef } from 'react';
import { creationRequestId } from '../model/creationRequestId';
import { databaseContainerApi } from '@/lib/api-client';
import type { DatabaseContainer, KnowledgeDatabase } from '../model/types';
export function DatabaseSources({
    teamId,
    container,
    sources,
    activeId,
    busy,
    canWrite,
    mutate,
    onSelect,
}: {
    teamId: string;
    container: DatabaseContainer;
    sources: KnowledgeDatabase[];
    activeId: string;
    busy: boolean;
    canWrite: boolean;
    mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
    onSelect: (id: string) => void;
}) {
    const creation = useRef<{ key: string; id: string } | null>(null);
    const [name, setName] = useState('');
    const [selected, setSelected] = useState('');
    const input = 'rounded-control border border-border-primary bg-bg-primary p-2 text-xs';
    const button = 'rounded-control border border-border-primary px-2 py-1 text-xs disabled:opacity-50';
    return (
        <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer">
                데이터 소스 · {container.sources.find((source) => source.id === activeId)?.name}
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-control border border-border-primary p-3">
                <label>
                    표시할 데이터 소스{' '}
                    <select
                        aria-label="표시할 데이터 소스"
                        className={input}
                        value={activeId}
                        disabled={busy}
                        onChange={(event) => onSelect(event.target.value)}
                    >
                        {container.sources.map((source) => (
                            <option key={source.id} value={source.id}>
                                {source.name}
                            </option>
                        ))}
                    </select>
                </label>
                {canWrite && (
                    <>
                        <button
                            type="button"
                            className={button}
                            disabled={busy || container.sources.length <= 1}
                            onClick={async () => {
                                const success = await mutate(
                                    () =>
                                        databaseContainerApi.unlink(teamId, container.id, activeId, container.revision),
                                    '이 화면에서 연결을 해제했습니다. 원본 데이터와 다른 페이지의 연결은 유지됩니다.',
                                );
                                if (success) onSelect(container.sources.find((source) => source.id !== activeId)!.id);
                            }}
                        >
                            현재 소스 연결 해제
                        </button>
                        <form
                            className="flex flex-wrap gap-2"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                let sourceId = '';
                                const success = await mutate(async () => {
                                    const response = await databaseContainerApi.createSource(
                                        teamId,
                                        container.id,
                                        name,
                                        container.revision,
                                        creationRequestId(creation, name.trim()),
                                    );
                                    if (!response.data) throw new Error('데이터 소스를 생성하지 못했습니다.');
                                    sourceId = response.data.sourceId;
                                }, '새 데이터 소스를 추가했습니다.');
                                if (success) {
                                    creation.current = null;
                                    setName('');
                                    onSelect(sourceId);
                                }
                            }}
                        >
                            <input
                                aria-label="새 데이터 소스 이름"
                                className={input}
                                required
                                maxLength={100}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                disabled={busy}
                            />
                            <button className={button} disabled={busy}>
                                데이터 소스 추가
                            </button>
                        </form>
                        <form
                            className="flex flex-wrap gap-2"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                const success = await mutate(
                                    () => databaseContainerApi.link(teamId, container.id, selected, container.revision),
                                    '기존 데이터 소스를 연결했습니다. 같은 원본을 함께 사용합니다.',
                                );
                                if (success) {
                                    onSelect(selected);
                                    setSelected('');
                                }
                            }}
                        >
                            <select
                                aria-label="연결할 데이터 소스"
                                className={input}
                                required
                                value={selected}
                                onChange={(event) => setSelected(event.target.value)}
                                disabled={busy}
                            >
                                <option value="">기존 데이터 소스 선택</option>
                                {sources
                                    .filter((source) => !container.sources.some((item) => item.id === source.id))
                                    .map((source) => (
                                        <option key={source.id} value={source.id}>
                                            {source.name}
                                        </option>
                                    ))}
                            </select>
                            <button className={button} disabled={busy || !selected}>
                                데이터 소스 연결
                            </button>
                        </form>
                    </>
                )}
            </div>
        </details>
    );
}
