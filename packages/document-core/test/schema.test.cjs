const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSchema, validateRowPatch } = require('../dist/index.js');

const title = { id: 'title-1', name: '제목', type: 'title' };
const schema = (...properties) => ({
    version: 1, id: 'source-1', teamId: 'team-1', revision: 3,
    properties: [title, ...properties],
});
const codes = result => result.map(item => item.code);
const validate = (property, value) => validateRowPatch(
    property.type === 'title' ? { ...schema(), properties: [property] } : schema(property),
    { [property.id]: value }, 3,
);

test('renaming a property preserves ID-addressed values', () => {
    const before = schema({ id: 'estimate', name: 'Estimate', type: 'number' });
    const after = structuredClone(before);
    after.properties[1].name = '예상 소요 시간';
    assert.deepEqual(validateRowPatch(before, { estimate: 8 }, 3), []);
    assert.deepEqual(validateRowPatch(after, { estimate: 8 }, 3), []);
});

test('rejects stale schema revisions before accepting a partial write', () => {
    assert.deepEqual(codes(validateRowPatch(schema(), {}, 2)), ['schema_conflict']);
});

test('rejects duplicate stable IDs and missing or multiple titles', () => {
    assert.ok(codes(validateSchema(schema({ ...title, type: 'number' }))).includes('duplicate_id'));
    assert.ok(codes(validateSchema({ ...schema(), properties: [] })).includes('invalid_title_count'));
    assert.ok(codes(validateSchema(schema({ ...title, id: 'other' }))).includes('invalid_title_count'));
});

test('rejects unknown properties, arrays and undefined instead of dropping/coercing', () => {
    assert.deepEqual(codes(validateRowPatch(schema(), { missing: 1 }, 3)), ['unknown_property']);
    assert.deepEqual(codes(validateRowPatch(schema(), [], 3)), ['invalid_patch']);
    assert.deepEqual(codes(validateRowPatch(schema(), { 'title-1': undefined }, 3)), ['invalid_value']);
});

test('empty patch leaves values unchanged, null explicitly clears a writable value', () => {
    assert.deepEqual(validateRowPatch(schema(), {}, 3), []);
    assert.deepEqual(validateRowPatch(schema(), { 'title-1': null }, 3), []);
});

test('supports text runs without silently discarding unsupported rich text', () => {
    assert.deepEqual(validate(title, [{ type: 'text', text: '문서 제목' }]), []);
    assert.deepEqual(codes(validate(title, [{ type: 'mention', id: 'page' }])), ['invalid_value']);
    assert.deepEqual(codes(validate(title, [{ type: 'text', text: 'bold', bold: true }])), ['invalid_value']);
});

test('rejects non-finite numbers and string booleans', () => {
    for (const value of [NaN, Infinity, '12']) {
        assert.deepEqual(codes(validate({ id: 'n', name: 'n', type: 'number' }, value)), ['invalid_value']);
    }
    assert.deepEqual(validate({ id: 'n', name: 'n', type: 'number' }, 0), []);
    assert.deepEqual(codes(validate({ id: 'b', name: 'b', type: 'checkbox' }, 'false')), ['invalid_value']);
    assert.deepEqual(validate({ id: 'b', name: 'b', type: 'checkbox' }, false), []);
});

test('select and multi-select use option IDs and reject unknown or duplicate IDs', () => {
    const property = { id: 'tags', name: 'Tags', type: 'multi_select', options: [{ id: 'red', name: 'Red' }] };
    assert.deepEqual(validate(property, ['red']), []);
    for (const value of [['Red'], ['red', 'red'], 'red']) {
        assert.deepEqual(codes(validate(property, value)), ['invalid_value']);
    }
    assert.deepEqual(validate({ ...property, type: 'select' }, 'red'), []);
    assert.deepEqual(codes(validate({ ...property, type: 'select' }, 'Red')), ['invalid_value']);
});

test('status options must belong to exactly one group', () => {
    const property = {
        id: 'state', name: 'State', type: 'status',
        options: [{ id: 'todo', name: 'Todo' }],
        groups: [{ id: 'pending', name: 'Pending', optionIds: ['todo'] }],
    };
    assert.deepEqual(validate(property, 'todo'), []);
    assert.ok(codes(validateSchema(schema({ ...property, groups: [] }))).includes('invalid_reference'));
    assert.ok(codes(validateSchema(schema({ ...property, groups: [...property.groups, { id: 'done', name: 'Done', optionIds: ['todo'] }] }))).includes('invalid_reference'));
});

test('validates calendar dates, offsets, range ordering and precision', () => {
    const property = { id: 'date', name: 'Date', type: 'date' };
    for (const value of [
        { start: '2024-02-29' },
        { start: '2026-10-20T09:00:00+09:00', end: '2026-10-20T01:00:00Z' },
    ]) assert.deepEqual(validate(property, value), []);
    for (const value of [
        { start: '2025-02-29' }, { start: '2026-04-31' },
        { start: '2026-10-20T24:00:00Z' }, { start: '2026-10-20T09:00:00' },
        { start: '2026-10-20', end: '2026-10-19' },
        { start: '2026-10-20', end: '2026-10-20T10:00:00Z' },
        { start: '2026-10-20', time_zone: 'Asia/Seoul' },
    ]) assert.deepEqual(codes(validate(property, value)), ['invalid_value'], JSON.stringify(value));
});

test('relations enforce cardinality without pretending to resolve page access', () => {
    const property = { id: 'rel', name: 'Relation', type: 'relation', targetDataSourceId: 'other-source', cardinality: 'one' };
    assert.deepEqual(validate(property, ['page-1']), []);
    assert.deepEqual(codes(validate(property, ['page-1', 'page-2'])), ['invalid_value']);
    assert.deepEqual(codes(validate({ ...property, cardinality: 'many' }, ['page-1', 'page-1'])), ['invalid_value']);
});

test('formula, rollup and system values are read-only even when clearing', () => {
    const properties = [
        { id: 'rel', name: 'Relation', type: 'relation', targetDataSourceId: 'other', cardinality: 'many' },
        { id: 'sum', name: 'Sum', type: 'rollup', relationPropertyId: 'rel', targetPropertyId: 'amount', aggregation: 'sum' },
        { id: 'formula', name: 'Formula', type: 'formula', expression: '1 + 1' },
        ...['created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id'].map(type => ({ id: type, name: type, type })),
    ];
    for (const property of properties.slice(1)) {
        assert.deepEqual(codes(validateRowPatch(schema(...properties), { [property.id]: null }, 3)), ['read_only']);
    }
});

test('rejects rollups whose local source is not a relation', () => {
    const rollup = { id: 'r', name: 'Rollup', type: 'rollup', relationPropertyId: 'title-1', targetPropertyId: 'amount', aggregation: 'sum' };
    assert.ok(codes(validateSchema(schema(rollup))).includes('invalid_reference'));
});

test('URL and email checks reject unsafe schemes and credential-bearing URLs', () => {
    const property = { id: 'url', name: 'URL', type: 'url' };
    assert.deepEqual(validate(property, 'https://example.test/document'), []);
    for (const value of ['javascript:alert(1)', 'https://user:example@example.test', 'not-a-url']) {
        assert.deepEqual(codes(validate(property, value)), ['invalid_value']);
    }
    assert.deepEqual(validate({ ...property, type: 'email' }, 'sample@example.test'), []);
    assert.deepEqual(codes(validate({ ...property, type: 'email' }, 'bad value')), ['invalid_value']);
});

test('people and files store unique resource IDs, not expanded objects', () => {
    for (const type of ['people', 'files']) {
        const property = { id: type, name: type, type };
        assert.deepEqual(validate(property, ['resource-1']), []);
        assert.deepEqual(codes(validate(property, [{ id: 'resource-1' }])), ['invalid_value']);
    }
});

test('validator does not mutate caller schema or patch', () => {
    const inputSchema = schema({ id: 'n', name: 'Number', type: 'number' });
    const patch = { n: 4 };
    const original = structuredClone({ inputSchema, patch });
    validateRowPatch(inputSchema, patch, 3);
    assert.deepEqual({ inputSchema, patch }, original);
});

test('prototype-like IDs are treated as data, not inherited object keys', () => {
    const inputSchema = schema({ id: '__proto__', name: 'Text', type: 'phone_number' });
    assert.deepEqual(validateRowPatch(inputSchema, JSON.parse('{"__proto__":"sample"}'), 3), []);
    assert.deepEqual(codes(validateRowPatch(schema(), { toString: 'sample' }, 3)), ['unknown_property']);
});
