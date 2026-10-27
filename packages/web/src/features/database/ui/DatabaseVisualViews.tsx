'use client';

import { useMemo, useState } from 'react';
import type { DatabaseDetail, DatabaseRow, DatabaseView, PropertyValue } from '../model/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import { DatabaseCell } from './DatabaseCell';

const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const dayMs = 86400000;

export function DatabaseVisualViews({
    hiddenProperties,
    teamId,
    database,
    rows,
    layout,
    busy,
    members,
    saveCell,
    dateProperty,
    endProperty,
    onDatePropertyChange,
    onEndPropertyChange,
}: {
    dateProperty: string;
    endProperty: string;
    onDatePropertyChange: (id: string) => void;
    onEndPropertyChange: (id: string) => void;
    hiddenProperties: string[];
    teamId: string;
    database: DatabaseDetail;
    rows: DatabaseRow[];
    layout: DatabaseView['layout'];
    busy: boolean;
    members: TeamMemberSummary[];
    saveCell: (row: DatabaseRow, propertyId: string, value: PropertyValue) => Promise<boolean>;
}) {
    const dates = database.properties.filter((prop) => prop.type === 'date');
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    });
    const dateId = dates.some((prop) => prop.id === dateProperty) ? dateProperty : (dates[0]?.id ?? '');
    const start = new Date(month);
    start.setUTCDate(1 - ((start.getUTCDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * dayMs));
    const grouped = useMemo(() => {
        const map = new Map<string, DatabaseRow[]>();
        for (const row of rows) {
            const key = String(row.values[dateId] ?? '').slice(0, 10);
            map.set(key, [...(map.get(key) ?? []), row]);
        }
        return map;
    }, [rows, dateId]);
    const link = (row: DatabaseRow) => (
        <div className="flex min-w-0 items-center gap-1">
            <ResourceNavigation href={`/${teamId}/docs/${row.documentId}`} title={row.title} />
        </div>
    );
    const cells = (row: DatabaseRow) =>
        database.properties
            .filter((property) => !hiddenProperties.includes(property.id))
            .map((property) => (
                <div key={property.id} className="min-w-0 border-t border-border-primary py-1">
                    <span className="block text-[11px] text-text-tertiary">{property.name}</span>
                    <DatabaseCell
                        teamId={teamId}
                        databaseId={database.id}
                        row={row}
                        property={property}
                        members={members}
                        disabled={busy || !row.canEdit}
                        readOnly={!row.canEdit}
                        onSave={(value, revision) =>
                            saveCell({ ...row, revision: revision ?? row.revision }, property.id, value)
                        }
                    />
                </div>
            ));
    if (layout === 'list')
        return (
            <ul aria-label="데이터베이스 목록" className="divide-y divide-border-primary">
                {rows.map((row) => (
                    <li key={row.documentId} className="py-2">
                        <details>
                            <summary className="cursor-pointer text-sm">{row.title}</summary>
                            <div className="space-y-2 p-2">
                                {link(row)}
                                {cells(row)}
                            </div>
                        </details>
                    </li>
                ))}
            </ul>
        );
    if (layout === 'gallery')
        return (
            <div aria-label="데이터베이스 갤러리" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                    <article
                        key={row.documentId}
                        className="min-w-0 rounded-panel border border-border-primary bg-bg-secondary p-3"
                    >
                        {link(row)}
                        <div className="mt-3">{cells(row)}</div>
                    </article>
                ))}
            </div>
        );
    if (layout === 'chart') {
        const statuses = database.properties.find((prop) => prop.type === 'status');
        const counts = new Map<string, number>();
        for (const row of rows) {
            const label = String(row.values[statuses?.id ?? ''] ?? '미지정');
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        const maximum = Math.max(1, ...counts.values());
        return (
            <figure aria-label="상태별 항목 수 차트" className="space-y-3 p-3">
                <figcaption className="text-sm">상태별 항목 수</figcaption>
                {[...counts].map(([name, count]) => (
                    <div key={name} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
                        <span>{name}</span>
                        <div className="h-6 rounded bg-action/80" style={{ width: `${(count / maximum) * 100}%` }} />
                        <span>{count}</span>
                    </div>
                ))}
                {!rows.length && <p>표시할 데이터가 없습니다.</p>}
            </figure>
        );
    }
    const dateControls = (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            <label>
                날짜 속성{' '}
                <select
                    aria-label="보기 날짜 속성"
                    className="rounded-control border border-border-primary bg-bg-primary p-1"
                    value={dateId}
                    onChange={(e) => onDatePropertyChange(e.target.value)}
                >
                    {dates.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                            {prop.name}
                        </option>
                    ))}
                </select>
            </label>
            {layout === 'timeline' && (
                <label>
                    종료일{' '}
                    <select
                        aria-label="타임라인 종료일 속성"
                        className="rounded-control border border-border-primary bg-bg-primary p-1"
                        value={endProperty}
                        onChange={(e) => onEndPropertyChange(e.target.value)}
                    >
                        <option value="">시작일과 같음</option>
                        {dates.map((prop) => (
                            <option key={prop.id} value={prop.id}>
                                {prop.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <button
                aria-label="이전 달"
                className="rounded-control border border-border-primary px-2"
                onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}
            >
                ‹
            </button>
            <span>
                {month.getUTCFullYear()}년 {month.getUTCMonth() + 1}월
            </span>
            <button
                aria-label="다음 달"
                className="rounded-control border border-border-primary px-2"
                onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}
            >
                ›
            </button>
            <button
                className="rounded-control border border-border-primary px-2"
                onClick={() => {
                    const now = new Date();
                    setMonth(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
                }}
            >
                오늘
            </button>
        </div>
    );
    if (!dates.length)
        return (
            <p className="p-4 text-sm text-text-secondary">
                날짜 속성을 추가하면 {layout === 'calendar' ? '달력' : '타임라인'}에 항목을 배치할 수 있습니다.
            </p>
        );
    if (layout === 'calendar')
        return (
            <section aria-label="데이터베이스 달력" className="space-y-3">
                {dateControls}
                <div className="overflow-auto">
                    <div className="grid min-w-[630px] grid-cols-7 border-l border-t border-border-primary">
                        {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
                            <div key={day} className="border-b border-r border-border-primary p-2 text-center text-xs">
                                {day}
                            </div>
                        ))}
                        {days.map((date) => (
                            <div
                                key={dayKey(date)}
                                data-calendar-date={dayKey(date)}
                                className={`min-h-24 border-b border-r border-border-primary p-2 ${date.getUTCMonth() === month.getUTCMonth() ? '' : 'bg-bg-secondary'}`}
                                onDragOver={(e) => {
                                    if (!busy && e.dataTransfer.types.includes('application/slacord-database-row'))
                                        e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const id = e.dataTransfer.getData('application/slacord-database-row');
                                    const row = rows.find((item) => `${database.id}:${item.documentId}` === id);
                                    if (row?.canEdit && !busy) void saveCell(row, dateId, dayKey(date));
                                }}
                            >
                                <time dateTime={dayKey(date)} className="mb-1 block text-xs text-text-secondary">
                                    {date.getUTCDate()}
                                </time>
                                {(grouped.get(dayKey(date)) ?? []).map((row) => (
                                    <div
                                        key={row.documentId}
                                        draggable={row.canEdit && !busy}
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData(
                                                'application/slacord-database-row',
                                                `${database.id}:${row.documentId}`,
                                            );
                                        }}
                                        className="my-1 rounded-control border border-border-primary bg-bg-primary p-1"
                                    >
                                        {link(row)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <details>
                    <summary className="cursor-pointer text-sm">
                        날짜 없는 항목 ({grouped.get('')?.length ?? 0})
                    </summary>
                    {(grouped.get('') ?? []).map((row) => (
                        <div
                            key={row.documentId}
                            draggable={row.canEdit && !busy}
                            onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData(
                                    'application/slacord-database-row',
                                    `${database.id}:${row.documentId}`,
                                );
                            }}
                            className="p-2"
                        >
                            {link(row)}
                            <DatabaseCell
                                teamId={teamId}
                                databaseId={database.id}
                                row={row}
                                property={dates.find((p) => p.id === dateId)!}
                                members={members}
                                disabled={busy || !row.canEdit}
                                readOnly={!row.canEdit}
                                onSave={(value, revision) =>
                                    saveCell({ ...row, revision: revision ?? row.revision }, dateId, value)
                                }
                            />
                        </div>
                    ))}
                </details>
            </section>
        );
    const rangeStart = month.getTime(),
        rangeEnd = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1),
        count = (rangeEnd - rangeStart) / dayMs;
    return (
        <section aria-label="데이터베이스 타임라인" className="space-y-3">
            {dateControls}
            <div className="overflow-auto">
                <div className="min-w-[850px]">
                    <div className="grid grid-cols-[220px_1fr] border-b border-border-primary text-xs">
                        <span className="p-2">페이지</span>
                        <div className="flex">
                            {Array.from({ length: count }, (_, i) => (
                                <span key={i} className="flex-1 border-l border-border-primary text-center">
                                    {i + 1}
                                </span>
                            ))}
                        </div>
                    </div>
                    {rows.map((row) => {
                        const from = Date.parse(String(row.values[dateId] ?? '')),
                            rawEnd = Date.parse(String(row.values[endProperty] ?? row.values[dateId] ?? ''));
                        const until = Math.max(from, rawEnd) + dayMs,
                            left = Math.max(0, (from - rangeStart) / dayMs),
                            right = Math.min(count, (until - rangeStart) / dayMs);
                        return (
                            <div
                                key={row.documentId}
                                className="grid grid-cols-[220px_1fr] border-b border-border-primary"
                            >
                                <div className="p-2">{link(row)}</div>
                                <div className="relative min-h-10 border-l border-border-primary">
                                    {Number.isFinite(from) && right > left ? (
                                        <div
                                            aria-label={`${row.title}: ${String(row.values[dateId])} ~ ${String(row.values[endProperty] ?? row.values[dateId])}`}
                                            className="absolute top-2 h-6 rounded-control bg-action/70"
                                            style={{
                                                left: `${(left / count) * 100}%`,
                                                width: `${((right - left) / count) * 100}%`,
                                            }}
                                        />
                                    ) : (
                                        <span className="p-2 text-xs text-text-tertiary">
                                            {Number.isFinite(from) ? '표시 기간 밖' : '날짜 미지정'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
