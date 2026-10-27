import { validateDatabaseQuery, type FilterGroup } from '@slacord/document-core';
import type { DatabaseProperty, PropertyValue } from './types';
/** Only definite positive AND conditions become defaults. Search/OR/ranges never invent data. */
export function filterDefaults(
    properties: DatabaseProperty[],
    filter: FilterGroup,
    status = '',
    owner = '',
): Record<string, PropertyValue> {
    validateDatabaseQuery({ filter }, properties);
    const result: Record<string, PropertyValue> = Object.create(null);
    const conflicts = new Set<string>();
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
    visit(filter);
    if (status && properties.some((p) => p.id === 'status')) assign('status', status);
    if (owner && properties.some((p) => p.id === 'owner')) {
        const current = result.owner;
        if (!conflicts.has('owner')) result.owner = [...new Set([...(Array.isArray(current) ? current : []), owner])];
    }
    return result;
}
