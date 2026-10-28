import type { FilterGroup } from './query';
/** Names are presentation; stored IDs retain identity through renames. */
export interface OptionIdentity {
    id: string;
    name: string;
    /** Only pre-identity values use this name. Never update it on rename. */
    legacyName?: string;
}

export function renameOptionIdentity(options: readonly OptionIdentity[], id: string, name: string): OptionIdentity[] {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) throw new Error('선택 항목 이름은 1~80자여야 합니다.');
    if (!options.some((option) => option.id === id)) throw new Error('선택 항목을 찾을 수 없습니다.');
    if (options.some((option) => option.id !== id && option.name === trimmed))
        throw new Error('같은 이름의 선택 항목이 있습니다.');
    return options.map((option) => option.id === id ? { ...option, name: trimmed } : { ...option });
}

/** Decode persisted values, not newly typed names: legacy names may be reused. */
export function decodeOptionValue(options: readonly OptionIdentity[], value: string): string {
    return options.find((option) => option.id === value)?.name
        ?? options.find((option) => option.legacyName === value)?.name
        ?? value;
}

/** Encode current user input by current name, never by a historical alias. */
export function encodeOptionValue(options: readonly OptionIdentity[], name: string): string {
    const option = options.find((candidate) => candidate.name === name);
    if (!option) throw new Error('선택 항목을 찾을 수 없습니다.');
    return option.id;
}

/** Resolve persisted option references at query time so nested/linked views follow renames. */
export function resolveOptionFilter(filter: FilterGroup, properties: readonly { id: string; optionIdentities?: readonly OptionIdentity[] }[]): FilterGroup {
    const definitions = new Map(properties.map((property) => [property.id, property.optionIdentities]));
    const visit = (group: FilterGroup): FilterGroup => ({
        ...group,
        rules: group.rules.map((rule) => {
            if ('conjunction' in rule) return visit(rule);
            if (rule.operator === 'status_group_is' || rule.operator === 'status_group_is_not') return { ...rule };
            const options = definitions.get(rule.propertyId);
            return options && typeof rule.value === 'string'
                ? { ...rule, value: decodeOptionValue(options, rule.value) }
                : { ...rule };
        }),
    });
    return visit(filter);
}
