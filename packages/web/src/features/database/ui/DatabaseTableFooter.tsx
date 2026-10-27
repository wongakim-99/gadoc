'use client';
import {
    AGGREGATION_LABELS,
    NUMERIC_AGGREGATIONS,
    DATE_AGGREGATIONS,
    aggregateValues,
    type Aggregation,
} from '@slacord/document-core';
import type { DatabaseProperty, DatabaseRow } from '../model/types';
export function DatabaseTableFooter({
    rows,
    properties,
    calculations,
    onChange,
}: {
    rows: DatabaseRow[];
    properties: DatabaseProperty[];
    calculations: Record<string, Aggregation>;
    onChange: (next: Record<string, Aggregation>) => void;
}) {
    return (
        <tfoot className="border-t border-border-primary text-xs text-text-secondary">
            <tr>
                <td className="sticky left-0 bg-bg-primary px-3 py-2">{rows.length}개 페이지</td>
                {properties.map((property) => {
                    const selected = calculations[property.id];
                    const valid = selected && Object.hasOwn(AGGREGATION_LABELS, selected);
                    const value = valid
                        ? aggregateValues(
                              rows.map((row) => row.values[property.id]),
                              selected,
                          )
                        : null;
                    const result = Array.isArray(value)
                        ? value.join(', ')
                        : typeof value === 'number' && selected.startsWith('percent_')
                          ? `${Math.round(value * 10000) / 100}%`
                          : String(value ?? '—');
                    return (
                        <td key={property.id} className="group/calculation border-l border-border-primary p-2 align-top">
                            <select
                                aria-label={`${property.name} 열 계산`}
                                className={`max-w-full bg-transparent ${valid ? '' : 'opacity-0 group-hover/calculation:opacity-100 focus:opacity-100'}`}
                                value={valid ? selected : ''}
                                onChange={(event) => {
                                    const next = { ...calculations };
                                    if (event.target.value) next[property.id] = event.target.value as Aggregation;
                                    else delete next[property.id];
                                    onChange(next);
                                }}
                            >
                                <option value="">계산</option>
                                {Object.entries(AGGREGATION_LABELS)
                                    .filter(
                                        ([key]) =>
                                            !['show_original', 'show_unique'].includes(key) &&
                                            (!NUMERIC_AGGREGATIONS.includes(key as Aggregation) ||
                                                ['number', 'formula', 'rollup'].includes(property.type)) &&
                                            (!DATE_AGGREGATIONS.includes(key as Aggregation) ||
                                                ['date', 'created_time', 'last_edited_time'].includes(property.type)),
                                    )
                                    .map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {key === 'count' ? '모두 세기' : label}
                                        </option>
                                    ))}
                            </select>
                            {valid && (
                                <output
                                    aria-label={`${property.name} 계산 결과`}
                                    className="mt-1 block break-words tabular-nums"
                                >
                                    {result}
                                </output>
                            )}
                        </td>
                    );
                })}
            </tr>
        </tfoot>
    );
}
