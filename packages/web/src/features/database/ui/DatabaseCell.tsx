'use client';
import { useEffect, useRef, useState } from 'react';
import { DatabaseMenu } from './DatabaseMenu';
import { databaseApi } from '@/lib/api-client';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import type { DatabaseProperty, DatabaseRow, PropertyValue } from '../model/types';
import { useDatabaseDraftGuard } from '../model/useDatabaseDraftGuard';

export function DatabaseCell({
    teamId,
    databaseId,
    row,
    property,
    members,
    disabled,
    readOnly,
    onSave,
}: {
    teamId: string;
    databaseId: string;
    row: DatabaseRow;
    property: DatabaseProperty;
    members: TeamMemberSummary[];
    disabled: boolean;
    readOnly: boolean;
    onSave: (value: PropertyValue, revision?: number) => Promise<boolean>;
}) {
    const savedValue = row.values[property.id] ?? null;
    const [optimistic, setOptimistic] = useState<{ value: PropertyValue } | null>(null);
    const value = optimistic ? optimistic.value : savedValue;
    const savePromise = useRef<Promise<boolean> | null>(null);
    const editing = useRef(false);
    const draftRevision = useRef(row.revision);
    const [draft, setDraft] = useState(String(value ?? ''));
    const [choices, setChoices] = useState<Array<{ id: string; title: string }>>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mentioning, setMentioning] = useState(false);
    const [notice, setNotice] = useState('');
    useEffect(() => {
        if (!editing.current) setDraft(String(savedValue ?? ''));
    }, [savedValue]);
    const commit = (next: PropertyValue) => {
        if (savePromise.current) return savePromise.current;
        setOptimistic({ value: next });
        const promise = onSave(next, editing.current ? draftRevision.current : row.revision)
            .then((saved) => {
                if (saved) {
                    editing.current = false;
                    setDraft(String(next ?? ''));
                }
                return saved;
            })
            .finally(() => {
                setOptimistic(null);
                savePromise.current = null;
            });
        savePromise.current = promise;
        return promise;
    };
    useDatabaseDraftGuard(
        () => !!savePromise.current || (editing.current && draft !== String(savedValue ?? '')),
        () => {
            if (savePromise.current) return savePromise.current;
            if (
                readOnly ||
                !['text', 'number', 'date', 'url', 'email', 'phone'].includes(property.type) ||
                draft === String(savedValue ?? '')
            )
                return true;
            return commit(draft === '' ? null : property.type === 'number' ? Number(draft) : draft);
        },
    );
    const label = `${row.title} · ${property.name}`;
    const cellClass =
        'w-full min-w-32 rounded-control bg-transparent p-2 text-sm outline-none focus:bg-bg-secondary focus:ring-1 focus:ring-action disabled:opacity-70';
    if (['formula', 'rollup'].includes(property.type) && row.formulaErrors?.[property.id])
        return (
            <span role="status" title={row.formulaErrors[property.id]} className="block p-2 text-xs text-error">
                수식 오류: {row.formulaErrors[property.id]}
            </span>
        );
    if (['created_by', 'last_edited_by'].includes(property.type))
        return (
            <span aria-label={label} className="block p-2 text-sm">
                {(Array.isArray(value) ? value : [])
                    .map((id) => members.find((member) => member.userId === id)?.user?.username ?? '이전 멤버')
                    .join(', ') || '—'}
            </span>
        );
    if (['created_time', 'last_edited_time'].includes(property.type))
        return (
            <time aria-label={label} dateTime={String(value ?? '')} className="block p-2 text-xs">
                {value ? new Date(String(value)).toLocaleString('ko-KR') : '—'}
            </time>
        );
    if (property.type === 'rollup' || property.type === 'formula')
        return (
            <span aria-label={label} className="block p-2 tabular-nums text-text-secondary">
                {Array.isArray(value)
                    ? value.join(', ')
                    : typeof value === 'boolean'
                      ? value
                          ? '참'
                          : '거짓'
                      : (value ?? '—')}
            </span>
        );
    if (property.type === 'unique_id')
        return (
            <span aria-label={label} className="block p-2 text-xs font-mono text-text-secondary">
                {String(value ?? '—')}
            </span>
        );
    if (property.type === 'checkbox')
        return (
            <input
                aria-label={label}
                type="checkbox"
                disabled={disabled}
                checked={value === true}
                onChange={(e) => void commit(e.target.checked)}
            />
        );
    if (['status', 'select'].includes(property.type))
        return (
            <select
                aria-label={label}
                disabled={disabled}
                value={String(value ?? '')}
                className={`max-w-full cursor-pointer appearance-none rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-action ${value ? "bg-bg-hover text-text-primary" : "w-full bg-transparent"}`}
                onChange={(e) => void commit(e.target.value || null)}
            >
                <option value="" disabled={row.resourceKind === 'issue' && ['status', 'priority'].includes(property.id)}>{value ? '비우기' : ' '}</option>
                {property.options?.map((option) => (
                    <option key={option}>{option}</option>
                ))}
            </select>
        );
    if (['person', 'relation', 'multi_select'].includes(property.type)) {
        const selected = Array.isArray(value) ? value : [];
        const options =
            property.type === 'person'
                ? members
                      .filter(
                          (member) =>
                              row.availablePersonIds.includes(member.userId) || selected.includes(member.userId),
                      )
                      .map((member) => ({ id: member.userId, title: member.user?.username ?? '팀 멤버' }))
                : property.type === 'multi_select'
                  ? (property.options?.map((option) => ({ id: option, title: option })) ?? [])
                  : choices;
        const labels =
            property.type === 'relation'
                ? (row.relations[property.id] ?? [])
                : options.filter((option) => selected.includes(option.id));
        return (
            <div className="p-1">
                {property.type === 'relation' &&
                    labels.map((item) => (
                        <div key={item.id} className="mb-1 flex items-center gap-1">
                            <ResourceNavigation href={`/${teamId}/docs/${item.id}`} title={item.title} />
                        </div>
                    ))}
                {readOnly ? (
                    <span className="text-xs text-text-secondary">
                        {property.type === 'relation' ? '' : labels.map((item) => item.title).join(', ') || '미지정'}
                    </span>
                ) : (
                    <DatabaseMenu label={label}
                        icon={property.type === 'relation' ? '연결 편집' : labels.map(item=>item.title).join(', ') || ' '}
                        triggerClassName="block min-h-7 w-full cursor-pointer rounded-control p-1 text-left text-xs text-text-secondary hover:bg-bg-hover focus-visible:ring-1 focus-visible:ring-action"
                        onOpenChange={async (open) => {
                            if (!open || property.type !== 'relation') return;
                            setLoading(true);
                            setError('');
                            try {
                                const result = await databaseApi.read(teamId, property.targetDatabaseId!);
                                if (!result.data) throw new Error('목록을 불러오지 못했습니다.');
                                setChoices(
                                    result.data.rows.map((item) => ({ id: item.documentId, title: item.title })),
                                );
                            } catch (caught) {
                                setError(caught instanceof Error ? caught.message : '목록 오류');
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >

                        <div className="mt-1 max-h-52 min-w-48 overflow-y-auto rounded-control border border-border-primary bg-bg-secondary p-2">
                            {property.type === 'person' && (
                                <p className="px-2 text-xs text-text-tertiary">
                                    이 페이지에 접근할 수 있는 사람 · 복수 선택 가능
                                </p>
                            )}
                            <input
                                aria-label={`${property.name} 검색`}
                                placeholder="검색"
                                className={cellClass}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {loading ? (
                                <p role="status" className="text-xs">
                                    불러오는 중…
                                </p>
                            ) : (
                                options
                                    .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
                                    .map((option) => (
                                        <div key={option.id} className="flex items-center gap-2 p-2 text-xs">
                                            <label className="flex flex-1 items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(option.id)}
                                                    disabled={
                                                        disabled ||
                                                        mentioning ||
                                                        (property.type === 'person' &&
                                                            !row.availablePersonIds.includes(option.id) &&
                                                            !selected.includes(option.id))
                                                    }
                                                    onChange={(e) =>
                                                        void commit(
                                                            e.target.checked
                                                                ? property.type === 'relation' &&
                                                                  property.cardinality === 'one'
                                                                    ? [option.id]
                                                                    : [...selected, option.id]
                                                                : selected.filter((id) => id !== option.id),
                                                        )
                                                    }
                                                />
                                                {option.title}
                                            </label>
                                            {property.type === 'person' && row.resourceKind !== 'issue' &&
                                                row.availablePersonIds.includes(option.id) && (
                                                    <button
                                                        type="button"
                                                        disabled={mentioning}
                                                        aria-label={`${option.title}에게 확인 요청`}
                                                        className="text-action-text"
                                                        onClick={async () => {
                                                            setMentioning(true);
                                                            setError('');
                                                            setNotice('');
                                                            try {
                                                                await databaseApi.mention(
                                                                    teamId,
                                                                    databaseId,
                                                                    row.documentId,
                                                                    [option.id],
                                                                );
                                                                setNotice(`${option.title}에게 알림을 보냈습니다.`);
                                                            } catch (caught) {
                                                                setError(
                                                                    caught instanceof Error
                                                                        ? caught.message
                                                                        : '알림을 보내지 못했습니다.',
                                                                );
                                                            } finally {
                                                                setMentioning(false);
                                                            }
                                                        }}
                                                    >
                                                        @ 호출
                                                    </button>
                                                )}
                                        </div>
                                    ))
                            )}
                            {!loading && !options.length && (
                                <p className="text-xs text-text-tertiary">선택할 항목이 없습니다.</p>
                            )}
                            {error && (
                                <p role="alert" className="text-xs text-error">
                                    {error}
                                </p>
                            )}
                            {notice && (
                                <p role="status" className="text-xs text-text-secondary">
                                    {notice}
                                </p>
                            )}
                        </div>
                    </DatabaseMenu>
                )}
            </div>
        );
    }
    const conflict = editing.current && draftRevision.current !== row.revision && draft !== String(savedValue ?? '');
    return (
        <div data-manages-draft-navigation="true">
            <input
                aria-label={label}
                disabled={disabled}
                className={`${cellClass} ${property.type === 'date' && !draft ? 'text-transparent focus:text-text-primary [&::-webkit-calendar-picker-indicator]:opacity-0 focus:[&::-webkit-calendar-picker-indicator]:opacity-100' : ''}`}
                value={draft}
                type={
                    property.type === 'number'
                        ? 'number'
                        : property.type === 'date'
                          ? 'date'
                          : property.type === 'url'
                            ? 'url'
                            : property.type === 'email'
                              ? 'email'
                              : property.type === 'phone'
                                ? 'tel'
                                : 'text'
                }
                step={property.type === 'number' ? 'any' : undefined}
                onChange={(e) => {
                    if (!editing.current) draftRevision.current = row.revision;
                    editing.current = true;
                    setDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={() => {
                    const next = draft === '' ? null : property.type === 'number' ? Number(draft) : draft;
                    if (next !== value) void commit(next);
                }}
            />
            {conflict && (
                <div className="space-y-1 rounded border border-border-primary p-2 text-xs" role="status">
                    <p>다른 사용자가 이 항목을 변경했습니다. 현재 값: {String(savedValue ?? '비어 있음')}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={disabled}
                            className="underline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                editing.current = false;
                                draftRevision.current = row.revision;
                                setDraft(String(savedValue ?? ''));
                            }}
                        >
                            현재 값 사용
                        </button>
                        <button
                            type="button"
                            disabled={disabled}
                            className="underline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                draftRevision.current = row.revision;
                                void commit(draft === '' ? null : property.type === 'number' ? Number(draft) : draft);
                            }}
                        >
                            내 값으로 다시 저장
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
