export * from './option-color';
export * from './number-format';
export * from './document-layout';

/**
 * Slacord's own storage contract, not a recovered Notion server schema.
 * IDs survive renames. Database containers, data sources and row pages are
 * separate identities; authorization remains an application-layer obligation.
 */
export interface PropertyOption {
    id: string;
    name: string;
    color?: string;
}

interface PropertyBase {
    id: string;
    name: string;
}

export type PropertyDefinition = PropertyBase & (
    | { type: 'title' | 'rich_text' | 'number' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'date' | 'people' | 'files' }
    | { type: 'select' | 'multi_select'; options: readonly PropertyOption[] }
    | { type: 'status'; options: readonly PropertyOption[]; groups: readonly { id: string; name: string; optionIds: readonly string[] }[] }
    | { type: 'relation'; targetDataSourceId: string; cardinality: 'one' | 'many' }
    | { type: 'formula'; expression: string }
    | { type: 'rollup'; relationPropertyId: string; targetPropertyId: string; aggregation: 'count' | 'count_all' | 'sum' | 'average' | 'min' | 'max' | 'show_original' | 'show_unique' }
    | { type: 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by' | 'unique_id' }
);

export interface DataSourceSchema {
    version: 1;
    id: string;
    teamId: string;
    revision: number;
    properties: readonly PropertyDefinition[];
}

export interface DatabaseContainer {
    id: string;
    teamId: string;
    pageId: string;
    dataSourceIds: readonly string[];
}

export interface RowPage {
    id: string;
    teamId: string;
    dataSourceId: string;
    schemaRevision: number;
    revision: number;
    /** Omitted property means unset. null explicitly clears a writable value. */
    properties: Readonly<Record<string, unknown>>;
    /** Content is independently versioned; editor JSON is not the row schema. */
    contentId: string;
}

export interface ValidationIssue {
    path: string;
    code: 'invalid_schema' | 'duplicate_id' | 'invalid_title_count' | 'invalid_reference'
        | 'schema_conflict' | 'invalid_patch' | 'unknown_property' | 'read_only' | 'invalid_value';
    message: string;
}

const readOnlyTypes = new Set([
    'formula', 'rollup', 'created_time', 'created_by',
    'last_edited_time', 'last_edited_by', 'unique_id',
]);
const writableTypes = new Set([
    'title', 'rich_text', 'number', 'checkbox', 'url', 'email', 'phone_number',
    'date', 'people', 'files', 'select', 'multi_select', 'status', 'relation',
]);
const nonEmpty = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const uniqueIds = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(nonEmpty) && new Set(value).size === value.length;
const issue = (path: string, code: ValidationIssue['code'], message: string): ValidationIssue =>
    ({ path, code, message });

/**
 * Checks a typed internal schema. Untrusted JSON must first be decoded by the
 * API boundary. Does not establish referenced source/property existence or ACL.
 */
export function validateSchema(schema: DataSourceSchema): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (schema.version !== 1 || !nonEmpty(schema.id) || !nonEmpty(schema.teamId)
        || !Number.isSafeInteger(schema.revision) || schema.revision < 1) {
        issues.push(issue('schema', 'invalid_schema', 'Expected version 1, nonempty identities and a positive revision.'));
    }
    if (schema.properties.filter(p => p.type === 'title').length !== 1) {
        issues.push(issue('properties', 'invalid_title_count', 'A data source must contain exactly one title property.'));
    }
    const ids = new Set<string>();
    for (const property of schema.properties) {
        const path = `properties.${property.id}`;
        if (!nonEmpty(property.id) || !nonEmpty(property.name)
            || (!writableTypes.has(property.type) && !readOnlyTypes.has(property.type))) {
            issues.push(issue(path, 'invalid_schema', 'Property identity, name or type is invalid.'));
        }
        if (ids.has(property.id)) issues.push(issue(path, 'duplicate_id', 'Property IDs must be unique.'));
        ids.add(property.id);
        if ('options' in property) {
            if (!uniqueIds(property.options.map(o => o.id)) || property.options.some(o => !nonEmpty(o.name))) {
                issues.push(issue(path, 'invalid_schema', 'Options require unique nonempty IDs and names.'));
            }
        }
        if (property.type === 'status') {
            const assigned = property.groups.flatMap(group => [...group.optionIds]);
            const optionIds = new Set(property.options.map(option => option.id));
            if (!uniqueIds(property.groups.map(group => group.id))
                || property.groups.some(group => !nonEmpty(group.name))
                || !uniqueIds(assigned) || assigned.length !== optionIds.size
                || assigned.some(id => !optionIds.has(id))) {
                issues.push(issue(path, 'invalid_reference', 'Each status option must belong to exactly one valid group.'));
            }
        }
        if (property.type === 'relation'
            && (!nonEmpty(property.targetDataSourceId) || !['one', 'many'].includes(property.cardinality))) {
            issues.push(issue(path, 'invalid_reference', 'Relations require a target source and cardinality.'));
        }
        if (property.type === 'formula' && !nonEmpty(property.expression)) {
            issues.push(issue(path, 'invalid_schema', 'A formula requires an expression; syntax is checked by the future formula engine.'));
        }
        if (property.type === 'rollup') {
            const relation = schema.properties.find(p => p.id === property.relationPropertyId);
            if (relation?.type !== 'relation' || !nonEmpty(property.targetPropertyId)
                || !['count', 'count_all', 'sum', 'average', 'min', 'max', 'show_original', 'show_unique'].includes(property.aggregation)) {
                issues.push(issue(path, 'invalid_reference', 'Rollups require a relation, target property and supported aggregation.'));
            }
        }
    }
    return issues;
}

function validDate(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    // Date-only or an offset-aware RFC3339 subset. No ambiguous local timestamps.
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
    const dateOnly = value.slice(0, 10);
    const day = new Date(`${dateOnly}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== dateOnly) return false;
    if (value.length > 10) {
        const hour = Number(value.slice(11, 13));
        const minute = Number(value.slice(14, 16));
        const second = Number(value.slice(17, 19));
        if (hour > 23 || minute > 59 || second > 59) return false;
    }
    return Number.isFinite(Date.parse(value));
}

function validText(value: unknown): boolean {
    // Foundation text runs. Mentions/equations/annotations need versioned variants.
    return Array.isArray(value) && value.every(run => record(run)
        && Object.keys(run).every(key => key === 'type' || key === 'text')
        && run.type === 'text' && typeof run.text === 'string');
}

function validValue(property: PropertyDefinition, value: unknown): boolean {
    if (value === null) return true;
    switch (property.type) {
        case 'title':
        case 'rich_text': return validText(value);
        case 'number': return typeof value === 'number' && Number.isFinite(value);
        case 'checkbox': return typeof value === 'boolean';
        case 'phone_number': return typeof value === 'string';
        case 'email': return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'url': {
            if (typeof value !== 'string') return false;
            try {
                const url = new URL(value);
                return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
            } catch { return false; }
        }
        case 'select':
        case 'status': return typeof value === 'string' && property.options.some(option => option.id === value);
        case 'multi_select':
            return uniqueIds(value) && value.every(id => property.options.some(option => option.id === id));
        case 'people': return uniqueIds(value);
        case 'files': return uniqueIds(value); // Slacord asset IDs; signed URLs are resolved at read time.
        case 'relation':
            return uniqueIds(value) && (property.cardinality === 'many' || value.length <= 1);
        case 'date': {
            if (!record(value) || !Object.keys(value).every(key => ['start', 'end'].includes(key))
                || !validDate(value.start)) return false;
            if (value.end === undefined || value.end === null) return true;
            return validDate(value.end) && (value.start.length === 10) === (value.end.length === 10)
                && Date.parse(value.end) >= Date.parse(value.start);
        }
        default: return false;
    }
}

/**
 * Validate a partial user write against a known schema. Omission preserves values;
 * null clears values. Never coerce or silently drop unknown/unsupported fields.
 * Callers must check team membership, property ACL, referenced resources and row
 * revision, then persist atomically with a schema revision predicate.
 */
export function validateRowPatch(
    schema: DataSourceSchema,
    patch: unknown,
    expectedSchemaRevision: number,
): ValidationIssue[] {
    const schemaIssues = validateSchema(schema);
    if (schemaIssues.length) return schemaIssues;
    if (expectedSchemaRevision !== schema.revision) {
        return [issue('schemaRevision', 'schema_conflict', 'Reload the schema before writing.')];
    }
    if (!record(patch)) return [issue('properties', 'invalid_patch', 'Expected a property-ID keyed object.')];
    const byId = new Map(schema.properties.map(property => [property.id, property]));
    const issues: ValidationIssue[] = [];
    for (const [id, value] of Object.entries(patch)) {
        const path = `properties.${id}`;
        const property = byId.get(id);
        if (!property) issues.push(issue(path, 'unknown_property', 'Property does not exist in this schema.'));
        else if (readOnlyTypes.has(property.type)) issues.push(issue(path, 'read_only', 'Computed and system properties cannot be written directly.'));
        else if (!validValue(property, value)) issues.push(issue(path, 'invalid_value', `Invalid value for ${property.type}.`));
    }
    return issues;
}

export * from './query';

export * from './aggregate';

export * from './number-presentation';
