'use client';

import { useEffect, useState } from 'react';
import { STATUS_GROUP_KEYS, STATUS_GROUP_LABELS } from '@slacord/document-core';
import type { FilterGroup, FilterOperator, FilterRule, SortRule } from '@slacord/document-core';
import type { DatabaseProperty } from '../model/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { databaseApi } from '@/lib/api-client';

const labels: Record<FilterOperator, string> = {
    status_group_is: '상태 그룹이 같음',
    status_group_is_not: '상태 그룹이 다름',
    equals: '같음',
    not_equals: '같지 않음',
    contains: '포함',
    not_contains: '포함하지 않음',
    starts_with: '시작 문자',
    ends_with: '끝 문자',
    is_empty: '비어 있음',
    is_not_empty: '비어 있지 않음',
    greater_than: '초과 / 이후',
    greater_or_equal: '이상',
    less_than: '미만 / 이전',
    less_or_equal: '이하',
};
const inputClass = 'min-w-0 rounded-control border border-border-primary bg-bg-primary p-2 text-xs';
const newRule = (): FilterRule => ({ propertyId: 'title', operator: 'contains', value: '' });

function Condition({
    teamId,
    rule,
    properties,
    members,
    onChange,
    onRemove,
}: {
    teamId: string;
    rule: FilterRule;
    properties: DatabaseProperty[];
    members: TeamMemberSummary[];
    onChange: (rule: FilterRule) => void;
    onRemove: () => void;
}) {
    const prop = properties.find((p) => p.id === rule.propertyId);
    const [targets, setTargets] = useState<Array<{ id: string; title: string }>>([]);
    const [loadError, setLoadError] = useState('');
    useEffect(() => {
        let active = true;
        setTargets([]);
        setLoadError('');
        if (prop?.type === 'relation' && prop.targetDatabaseId)
            void databaseApi
                .read(teamId, prop.targetDatabaseId)
                .then((result) => {
                    if (active)
                        setTargets(result.data?.rows.map((row) => ({ id: row.documentId, title: row.title })) ?? []);
                })
                .catch(() => {
                    if (active) setLoadError('관계 항목을 불러오지 못했습니다.');
                });
        return () => {
            active = false;
        };
    }, [teamId, prop?.type, prop?.targetDatabaseId]);
    const isStatusGroup = rule.operator === 'status_group_is' || rule.operator === 'status_group_is_not';
    const choices = isStatusGroup ? STATUS_GROUP_KEYS.map(group => ({ id: group, title: STATUS_GROUP_LABELS[group] })) :
        prop?.type === 'person'
            ? members.map((member) => ({ id: member.userId, title: member.user?.username ?? '팀 멤버' }))
            : prop?.type === 'relation'
              ? targets
              : prop?.options?.map((option) => ({ id: prop.optionIdentities?.find((item) => item.name === option)?.id ?? option, title: option }));
    return (
        <div className="flex flex-wrap items-center gap-2">
            <select
                aria-label="필터 속성"
                className={inputClass}
                value={rule.propertyId}
                onChange={(e) => {
                    const next = properties.find((p) => p.id === e.target.value);
                    onChange({
                        propertyId: e.target.value,
                        operator: ['person', 'relation', 'multi_select'].includes(next?.type ?? '')
                            ? 'contains'
                            : 'equals',
                        value: next?.type === 'checkbox' ? true : next?.type === 'number' ? 0 : '',
                    });
                }}
            >
                <option value="title">이름</option>
                {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                        {property.name}
                    </option>
                ))}
            </select>
            <select
                aria-label="필터 조건"
                className={inputClass}
                value={rule.operator}
                onChange={(e) => { const operator = e.target.value as FilterOperator; const nextGroup = operator === 'status_group_is' || operator === 'status_group_is_not'; onChange({ ...rule, operator, value: nextGroup ? (isStatusGroup ? rule.value : 'todo') : isStatusGroup ? '' : rule.value }); }}
            >
                {Object.entries(labels).filter(([key]) => !key.startsWith('status_group_') || prop?.type === 'status').map(([key, label]) => (
                    <option key={key} value={key}>
                        {label}
                    </option>
                ))}
            </select>
            {!['is_empty', 'is_not_empty'].includes(rule.operator) &&
                (prop?.type === 'checkbox' ? (
                    <select
                        aria-label="필터 값"
                        className={inputClass}
                        value={String(rule.value)}
                        onChange={(e) => onChange({ ...rule, value: e.target.value === 'true' })}
                    >
                        <option value="true">체크됨</option>
                        <option value="false">체크 안 됨</option>
                    </select>
                ) : choices ? (
                    <select
                        aria-label="필터 값"
                        className={inputClass}
                        value={isStatusGroup ? String(rule.value ?? '') : prop?.optionIdentities?.find((item) => item.id === rule.value || item.legacyName === rule.value)?.id ?? String(rule.value ?? '')}
                        onChange={(e) => onChange({ ...rule, value: e.target.value })}
                    >
                        <option value="">선택</option>
                        {choices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                                {choice.title}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        aria-label="필터 값"
                        className={inputClass}
                        type={prop?.type === 'number' ? 'number' : prop?.type === 'date' ? 'date' : 'text'}
                        value={String(rule.value ?? '')}
                        onChange={(e) =>
                            onChange({
                                ...rule,
                                value:
                                    prop?.type === 'number'
                                        ? e.target.value === ''
                                            ? null
                                            : Number(e.target.value)
                                        : e.target.value,
                            })
                        }
                    />
                ))}
            <button type="button" aria-label="필터 삭제" className={inputClass} onClick={onRemove}>
                ×
            </button>
            {loadError && (
                <span role="alert" className="text-xs text-error">
                    {loadError}
                </span>
            )}
        </div>
    );
}

export function DatabaseQueryBuilder({
    teamId,
    properties,
    members,
    filter,
    sorts,
    onFilterChange,
    onSortsChange,
    section = 'both',
}: {
    teamId: string;
    properties: DatabaseProperty[];
    members: TeamMemberSummary[];
    filter: FilterGroup;
    sorts: SortRule[];
    onFilterChange: (filter: FilterGroup) => void;
    onSortsChange: (sorts: SortRule[]) => void;
    section?: 'filter' | 'sort' | 'both';
}) {
    const group = (value: FilterGroup, change: (group: FilterGroup) => void, depth: number) => (
        <fieldset className="space-y-2 rounded-control border border-border-primary p-3">
            <legend className="px-1 text-xs">{depth === 1 ? '고급 필터' : '조건 그룹'}</legend>
            <select
                aria-label="필터 결합 방식"
                className={inputClass}
                value={value.conjunction}
                onChange={(e) => change({ ...value, conjunction: e.target.value as 'and' | 'or' })}
            >
                <option value="and">모든 조건 충족 (AND)</option>
                <option value="or">하나 이상 충족 (OR)</option>
            </select>
            {value.rules.map((rule, index) => (
                <div key={index} className="space-y-1">
                    {'conjunction' in rule ? (
                        <>
                            {group(
                                rule,
                                (child) =>
                                    change({ ...value, rules: value.rules.map((r, i) => (i === index ? child : r)) }),
                                depth + 1,
                            )}
                            <button
                                className={inputClass}
                                onClick={() => change({ ...value, rules: value.rules.filter((_, i) => i !== index) })}
                            >
                                조건 그룹 삭제
                            </button>
                        </>
                    ) : (
                        <Condition
                            teamId={teamId}
                            rule={rule}
                            properties={properties}
                            members={members}
                            onChange={(child) =>
                                change({ ...value, rules: value.rules.map((r, i) => (i === index ? child : r)) })
                            }
                            onRemove={() => change({ ...value, rules: value.rules.filter((_, i) => i !== index) })}
                        />
                    )}
                </div>
            ))}
            <div className="flex gap-2">
                <button className={inputClass} onClick={() => change({ ...value, rules: [...value.rules, newRule()] })}>
                    조건 추가
                </button>
                {depth < 3 && (
                    <button
                        className={inputClass}
                        onClick={() =>
                            change({ ...value, rules: [...value.rules, { conjunction: 'or', rules: [newRule()] }] })
                        }
                    >
                        조건 그룹 추가
                    </button>
                )}
            </div>
        </fieldset>
    );
    return (
        <div className="w-full space-y-3" aria-label="고급 조회 설정">
            {section !== 'sort' && group(filter, onFilterChange, 1)}
            {section !== 'filter' && (
                <fieldset className="space-y-2 rounded-control border border-border-primary p-3">
                    <legend className="px-1 text-xs">정렬 우선순위</legend>
                    {sorts.map((sort, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs">{index + 1}</span>
                            <select
                                aria-label="정렬 속성"
                                className={inputClass}
                                value={sort.propertyId}
                                onChange={(e) =>
                                    onSortsChange(
                                        sorts.map((s, i) => (i === index ? { ...s, propertyId: e.target.value } : s)),
                                    )
                                }
                            >
                                <option value="title">이름</option>
                                {properties.map((prop) => (
                                    <option key={prop.id} value={prop.id}>
                                        {prop.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                aria-label="정렬 방향"
                                className={inputClass}
                                value={sort.direction}
                                onChange={(e) =>
                                    onSortsChange(
                                        sorts.map((s, i) =>
                                            i === index
                                                ? { ...s, direction: e.target.value as SortRule['direction'] }
                                                : s,
                                        ),
                                    )
                                }
                            >
                                <option value="ascending">오름차순</option>
                                <option value="descending">내림차순</option>
                            </select>
                            <button
                                aria-label="정렬 우선순위 올리기"
                                className={inputClass}
                                disabled={index === 0}
                                onClick={() => {
                                    const next = [...sorts];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    onSortsChange(next);
                                }}
                            >
                                ↑
                            </button>
                            <button
                                aria-label="정렬 삭제"
                                className={inputClass}
                                onClick={() => onSortsChange(sorts.filter((_, i) => i !== index))}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        className={inputClass}
                        disabled={sorts.length >= 20}
                        onClick={() => onSortsChange([...sorts, { propertyId: 'title', direction: 'ascending' }])}
                    >
                        정렬 추가
                    </button>
                </fieldset>
            )}
        </div>
    );
}
