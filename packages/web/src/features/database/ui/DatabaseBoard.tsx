'use client';
import { resolveStatusGroups, STATUS_GROUP_KEYS, STATUS_GROUP_LABELS } from '@slacord/document-core';
import { databaseRowHref } from '../model/databaseRowHref';
import { useState } from 'react';
import type { DatabaseDetail, DatabaseRow, PropertyValue } from '../model/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import { DatabaseOptionTag } from './DatabaseOptionTag';
import { DatabaseCell } from './DatabaseCell';

const columnDragType = 'application/x-slacord-board-column';
const dragType = 'application/x-slacord-board-row';
export function DatabaseBoard({
    hiddenProperties,
    teamId,
    database,
    rows,
    members,
    busy,
    saveCell,
    groupProperty,
    statusGrouping = 'option',
    hideEmptyGroups = false,
    hiddenBoardGroups = [],
    boardGroupOrder = [],
    onHiddenBoardGroupsChange,
    onBoardGroupOrderChange,
    cardSize = 'medium',
    onStatusGroupingChange,
    onGroupPropertyChange,
}: {
    hiddenProperties: string[];
    teamId: string;
    database: DatabaseDetail;
    rows: DatabaseRow[];
    members: TeamMemberSummary[];
    busy: boolean;
    saveCell: (row: DatabaseRow, propertyId: string, value: PropertyValue) => Promise<boolean>;
    groupProperty: string;
    statusGrouping?: 'option' | 'group';
    hideEmptyGroups?: boolean;
    hiddenBoardGroups?: string[];
    boardGroupOrder?: string[];
    onHiddenBoardGroupsChange?: (groups: string[]) => void;
    onBoardGroupOrderChange?: (groups: string[]) => void;
    cardSize?: 'small' | 'medium' | 'large';
    onStatusGroupingChange?: (mode: 'option' | 'group') => void;
    onGroupPropertyChange: (id: string) => void;
}) {
    const [over, setOver] = useState<string | null>(null);
    const properties = database.properties.filter((p) =>
        ['status', 'select', 'multi_select', 'person', 'checkbox'].includes(p.type),
    );
    const prop = properties.find((p) => p.id === groupProperty) ?? properties[0];
    const groupedStatus = prop?.type === 'status' && statusGrouping === 'group';
    const identities = prop?.optionIdentities ?? (prop?.options ?? []).map(name => ({ id: name, name }));
    const memberships = resolveStatusGroups(identities, prop?.statusOptionGroups);
    const statusGroup = (name: string) => memberships.find(item => item.optionId === identities.find(option => option.name === name)?.id)?.group ?? 'todo';
    const statusOptions = (group: string) => (prop?.options ?? []).filter(name => statusGroup(name) === group);
    const keys = (row: DatabaseRow): string[] => {
        if (!prop) return [];
        const value = row.values[prop.id];
        if (prop.type === 'checkbox') return [value ? 'true' : 'false'];
        if (groupedStatus && typeof value === 'string' && value) return [statusGroup(value)];
        return Array.isArray(value) ? value.map(String) : value == null || value === '' ? [] : [String(value)];
    };
    const labels = new Map<string, string>();
    labels.set('', '미지정');
    if (prop?.type === 'checkbox') {
        labels.delete('');
        labels.set('false', '미완료');
        labels.set('true', '완료');
    } else if (groupedStatus) {
        for (const group of STATUS_GROUP_KEYS) labels.set(group, STATUS_GROUP_LABELS[group]);
    } else if (prop?.type === 'person')
        for (const member of members) labels.set(member.userId, member.user?.username ?? '팀 멤버');
    else for (const option of prop?.options ?? []) labels.set(option, option);
    for (const row of rows)
        for (const key of keys(row))
            if (!labels.has(key)) labels.set(key, prop?.type === 'person' ? '워크스페이스에서 나간 사람' : key);
    // Scope preferences to the property and use stable option identities across renames.
    const groupId = (key: string) => JSON.stringify([prop?.id, groupedStatus ? 'category' : 'option',
        !groupedStatus ? identities.find(option => option.name === key)?.id ?? key : key]);
    const ordered = [...labels].sort(([a], [b]) => {
        const rank = (key: string) => { const index = boardGroupOrder.indexOf(groupId(key)); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
        return rank(a) - rank(b);
    });
    const groupedRows = new Map([...labels.keys()].map(key => [key, rows.filter(row =>
        key === '' ? keys(row).length === 0 : keys(row).includes(key))]));
    const visibleGroups = ordered.filter(([key]) => !hiddenBoardGroups.includes(groupId(key)) &&
        !((key === '' || hideEmptyGroups) && groupedRows.get(key)!.length === 0));
    const reorder = (source: string, target: string) => {
        if (busy || source === target) return;
        const ids = ordered.map(([key]) => groupId(key));
        const from = ids.indexOf(source), to = ids.indexOf(target);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1); ids.splice(to, 0, source);
        onBoardGroupOrderChange?.([...boardGroupOrder.filter(id => !ids.includes(id)), ...ids].slice(-500));
    };
    const move = async (row: DatabaseRow, source: string, target: string) => {
        if (!prop || busy || !row.canEdit || source === target) return;
        if (groupedStatus && target && !statusOptions(target).length) return;
        let value: PropertyValue = groupedStatus && target ? statusOptions(target)[0] : target || null;
        if (prop.type === 'checkbox') value = target === 'true';
        if (prop.type === 'multi_select' || prop.type === 'person')
            value = target ? [...new Set([...keys(row).filter((k) => k !== source), target])] : [];
        await saveCell(row, prop.id, value);
    };
    return (
        <div className="space-y-3">
            <label className="text-sm text-text-secondary">
                그룹 기준{' '}
                <select
                    aria-label="보드 그룹 기준"
                    value={prop?.id ?? ''}
                    onChange={(e) => onGroupPropertyChange(e.target.value)}
                    className="rounded-control border border-border-primary bg-bg-primary px-2 py-1"
                >
                    {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </label>
            {prop?.type === 'status' && onStatusGroupingChange && <label className="ml-3 text-sm text-text-secondary">상태 표시{' '}
                <select aria-label="보드 상태 표시" value={statusGrouping} onChange={event => onStatusGroupingChange(event.target.value as 'option' | 'group')}
                    className="rounded-control border border-border-primary bg-bg-primary px-2 py-1">
                    <option value="option">옵션별</option><option value="group">그룹별</option>
                </select>
            </label>}
            {!prop && (
                <p className="text-sm text-text-secondary">
                    선택, 상태, 담당자 또는 체크박스 속성을 추가해 그룹을 나눌 수 있습니다.
                </p>
            )}
            {ordered.some(([key]) => hiddenBoardGroups.includes(groupId(key))) && <details className="text-xs text-text-secondary">
                <summary className="cursor-pointer py-2">숨긴 그룹</summary>
                <div className="flex flex-wrap gap-2">{ordered.filter(([key]) => hiddenBoardGroups.includes(groupId(key))).map(([key, label]) =>
                    <button key={key} type="button" disabled={busy} aria-label={`${label} 그룹 다시 표시`} className="rounded border border-border-primary px-3 py-2 hover:bg-bg-hover" onClick={() => onHiddenBoardGroupsChange?.(hiddenBoardGroups.filter(id => id !== groupId(key)))}>{label} · 다시 표시</button>
                )}</div>
            </details>}
            <div className="flex gap-3 overflow-x-auto pb-3" aria-label="데이터베이스 보드">
                {visibleGroups.map(([key, label], index) => {
                    const grouped = groupedRows.get(key)!;
                    return (
                        <section
                            key={key}
                            aria-label={`${label} 그룹`}
                            className={`${cardSize === 'small' ? 'w-56' : cardSize === 'large' ? 'w-96' : 'w-72'} shrink-0 rounded-panel border p-3 ${over === key ? 'border-action bg-bg-secondary' : 'border-border-primary bg-bg-secondary'}`}
                            onDragOver={(e) => {
                                if (e.dataTransfer.types.includes(columnDragType)) { e.preventDefault(); return; }
                                if (e.dataTransfer.types.includes(dragType) && !busy && (!groupedStatus || !key || statusOptions(key).length)) {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    setOver(key);
                                }
                            }}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                            }}
                            onDrop={(e) => {
                                const column = e.dataTransfer.getData(columnDragType);
                                if (column) { e.preventDefault(); e.stopPropagation(); try { const data = JSON.parse(column); if (data.databaseId === database.id) reorder(data.id, groupId(key)); } catch {} return; }
                                const raw = e.dataTransfer.getData(dragType);
                                if (!raw) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setOver(null);
                                try {
                                    const data = JSON.parse(raw);
                                    if (data.databaseId !== database.id) return;
                                    const row = rows.find((r) => r.documentId === data.documentId);
                                    if (row) void move(row, data.source, key);
                                } catch {
                                    /* Ignore foreign drag data. */
                                }
                            }}
                        >
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium" draggable={!busy && !!onBoardGroupOrderChange}
                                onDragStart={event => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(columnDragType, JSON.stringify({ databaseId: database.id, id: groupId(key) })); }}>

                                {prop && !groupedStatus && ['select', 'multi_select', 'status'].includes(prop.type) && key ? <DatabaseOptionTag property={prop} name={key}>{label}</DatabaseOptionTag> : label} <span className="text-text-tertiary">{grouped.length}</span>
                                <details className="relative ml-auto text-xs" draggable={false} onDragStart={event => event.stopPropagation()}>
                                    <summary aria-label={`${label} 그룹 옵션`} className="cursor-pointer list-none rounded px-2 py-1 hover:bg-bg-hover">···</summary>
                                    <div className="absolute right-0 z-20 w-36 rounded border border-border-primary bg-bg-primary p-1 shadow-lg">
                                        <button type="button" disabled={busy} className="block w-full p-2 text-left hover:bg-bg-hover" onClick={() => onHiddenBoardGroupsChange?.([...new Set([...hiddenBoardGroups, groupId(key)])].slice(-500))}>그룹 숨기기</button>
                                        <button type="button" disabled={busy || index === 0} className="block w-full p-2 text-left hover:bg-bg-hover disabled:opacity-40" onClick={() => reorder(groupId(key), groupId(visibleGroups[index - 1][0]))}>왼쪽으로 이동</button>
                                        <button type="button" disabled={busy || index === visibleGroups.length - 1} className="block w-full p-2 text-left hover:bg-bg-hover disabled:opacity-40" onClick={() => reorder(groupId(key), groupId(visibleGroups[index + 1][0]))}>오른쪽으로 이동</button>
                                    </div>
                                </details>
                            </h3>
                            <div className="min-h-16 space-y-3">
                                {grouped.map((row) => (
                                    <article
                                        key={row.documentId}
                                        aria-label={`${row.title} 카드`}
                                        draggable={row.canEdit && !busy && !!prop}
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData(
                                                dragType,
                                                JSON.stringify({
                                                    databaseId: database.id,
                                                    documentId: row.documentId,
                                                    source: key,
                                                }),
                                            );
                                        }}
                                        onDragEnd={() => setOver(null)}
                                        className="rounded-control border border-border-primary bg-bg-primary p-3"
                                    >
                                        {row.canEdit && prop && (
                                            <span
                                                draggable={!busy}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`${row.title} 카드 끌기`}
                                                title="끌어서 그룹 이동 · 키보드는 아래 그룹 이동 사용"
                                                className="mb-1 block w-fit cursor-grab rounded px-2 text-text-tertiary"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.currentTarget.parentElement?.querySelector('select')?.focus();
                                                    }
                                                }}
                                            >
                                                ⠿
                                            </span>
                                        )}
                                        <ResourceNavigation
                                            href={databaseRowHref(teamId, row)}
                                            title={row.title}
                                        />
                                        {row.canEdit && prop && (
                                            <label className="my-2 block text-xs text-text-tertiary">
                                                그룹 이동{' '}
                                                <select
                                                    aria-label={`${row.title} 그룹 이동`}
                                                    value={key}
                                                    disabled={busy}
                                                    onChange={(e) => void move(row, key, e.target.value)}
                                                    className="max-w-full rounded bg-bg-secondary p-1 text-text-primary"
                                                >
                                                    {[...labels].map(([value, name]) => (
                                                        <option key={value} value={value} disabled={!!(groupedStatus && value && !statusOptions(value).length)}>
                                                            {name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        <div className="mt-2 space-y-1">
                                            {database.properties
                                                .filter((property) => {
                                                    if (hiddenProperties.includes(property.id)) return false;
                                                    const value = row.values[property.id];
                                                    return !!row.formulaErrors?.[property.id] ||
                                                        (value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0));
                                                })
                                                .map((property) => (
                                                    <div key={property.id} className="min-w-0">
                                                        <span className="text-[11px] text-text-tertiary">
                                                            {property.name}
                                                        </span>
                                                        <DatabaseCell
                                                            teamId={teamId}
                                                            databaseId={database.id}
                                                            row={row}
                                                            property={property}
                                                            members={members}
                                                            disabled={busy || !row.canEdit}
                                                            readOnly={!row.canEdit}
                                                            onSave={(value, revision) =>
                                                                saveCell(
                                                                    { ...row, revision: revision ?? row.revision },
                                                                    property.id,
                                                                    value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
