import type { OptionIdentity } from './option-identity';

export const STATUS_GROUP_KEYS = ['todo', 'in_progress', 'complete'] as const;
export type StatusGroupKey = typeof STATUS_GROUP_KEYS[number];
export interface StatusOptionGroup { optionId: string; group: StatusGroupKey }
export interface StatusGroupAssignment { name: string; group: StatusGroupKey }
export const STATUS_GROUP_LABELS: Record<StatusGroupKey, string> = {
    todo: '할 일', in_progress: '진행 중', complete: '완료',
};

/** Legacy values without a known meaning remain in To-do, never silently completed. */
function initialGroup(name: string): StatusGroupKey {
    const normalized = name.trim().toLowerCase();
    if (['완료', '게시됨', '보관', 'done', 'complete', 'completed'].includes(normalized)) return 'complete';
    if (['진행 중', '진행중', '검토 중', 'in progress', 'in_progress', 'in_review'].includes(normalized)) return 'in_progress';
    return 'todo';
}

/** Membership follows identity across renames; the request names refer to the resulting schema. */
export function resolveStatusGroups(
    options: readonly OptionIdentity[],
    previous: readonly StatusOptionGroup[] = [],
    assignments: readonly StatusGroupAssignment[] = [],
): StatusOptionGroup[] {
    const names = new Set(options.map(option => option.name));
    if (new Set(assignments.map(item => item.name)).size !== assignments.length ||
        assignments.some(item => !names.has(item.name) || !STATUS_GROUP_KEYS.includes(item.group))) {
        throw new Error('상태 그룹에 속할 고유한 옵션과 올바른 그룹을 지정하세요.');
    }
    return options.map(option => ({
        optionId: option.id,
        group: assignments.find(item => item.name === option.name)?.group ??
            previous.find(item => item.optionId === option.id)?.group ?? initialGroup(option.legacyName ?? option.name),
    }));
}


export function statusCheckboxState(options: readonly OptionIdentity[], groups: readonly StatusOptionGroup[] | undefined, value: unknown) {
    const memberships = resolveStatusGroups(options, groups);
    const option = options.find(item => item.name === value) ?? options.find(item => item.id === value);
    const group = memberships.find(item => item.optionId === option?.id)?.group;
    const checked = group === 'complete';
    const targetGroup = checked ? 'todo' : 'complete';
    const nextValue = options.find(item => memberships.some(membership => membership.optionId === item.id && membership.group === targetGroup))?.name;
    return { checked, indeterminate: group === 'in_progress', nextValue };
}
