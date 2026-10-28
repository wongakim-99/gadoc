import { resolveStatusGroups, decodeOptionValue, resolveOptionFilter, validateDatabaseQuery, type FilterGroup } from '@slacord/document-core';
import type { DatabaseProperty, PropertyValue } from './types';
/** Positive AND conditions supply defaults; a status category uses its first option unless a specific compatible value exists. */
export function filterDefaults(
    properties: DatabaseProperty[],
    filter: FilterGroup,
    status = '',
    owner = '',
): Record<string, PropertyValue> {
    validateDatabaseQuery({ filter }, properties);
    const result: Record<string, PropertyValue> = Object.create(null);
    const conflicts = new Set<string>();
    const statusGroups = new Map<string, string>();
    const assign = (id: string, value: PropertyValue) => {
        if (conflicts.has(id)) return;
        if (Object.hasOwn(result, id) && JSON.stringify(result[id]) !== JSON.stringify(value)) {
            delete result[id];
            conflicts.add(id);
        } else result[id] = value;
    };
    const visit = (group: FilterGroup) => {
        if (group.conjunction !== 'and') return;
        for (const rule of group.rules) {
            if ('conjunction' in rule) {
                visit(rule);
                continue;
            }
            const property = properties.find((p) => p.id === rule.propertyId);
            if (!property || property.reverseOf) continue;
            if (rule.operator === 'status_group_is' && typeof rule.value === 'string') {
                if (statusGroups.has(property.id) && statusGroups.get(property.id) !== rule.value) {
                    conflicts.add(property.id); delete result[property.id];
                }
                statusGroups.set(property.id, rule.value);
            }
            if (
                rule.operator === 'equals' &&
                ['text', 'number', 'checkbox', 'select', 'status', 'date', 'email', 'phone', 'url'].includes(
                    property.type,
                ) &&
                rule.value !== undefined
            )
                assign(property.id, rule.value);
            if (
                rule.operator === 'contains' &&
                ['person', 'relation', 'multi_select'].includes(property.type) &&
                typeof rule.value === 'string' &&
                rule.value
            ) {
                const current = result[property.id];
                if (!conflicts.has(property.id))
                    result[property.id] = [...new Set([...(Array.isArray(current) ? current : []), rule.value])];
            }
        }
    };
    visit(resolveOptionFilter(filter, properties));
    if (status && properties.some((p) => p.id === 'status')) assign('status', decodeOptionValue(properties.find((p) => p.id === 'status')?.optionIdentities ?? [], status));
    for (const [id, group] of statusGroups) {
        if (conflicts.has(id)) continue;
        const property = properties.find(item => item.id === id)!;
        const options = property.optionIdentities ?? (property.options ?? []).map(name => ({ id: name, name }));
        const memberships = resolveStatusGroups(options, property.statusOptionGroups);
        const candidates = options.filter(option => memberships.some(item => item.optionId === option.id && item.group === group));
        if (Object.hasOwn(result, id)) {
            if (!candidates.some(option => option.name === result[id])) { delete result[id]; conflicts.add(id); }
        } else if (candidates.length) assign(id, candidates[0].name);
    }
    if (owner && properties.some((p) => p.id === 'owner')) {
        const current = result.owner;
        if (!conflicts.has('owner')) result.owner = [...new Set([...(Array.isArray(current) ? current : []), owner])];
    }
    return result;
}
