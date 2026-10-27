const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryDatabaseRows, validateDatabaseQuery } = require('../dist');
const properties = [{ id: 'cost', type: 'number' }, { id: 'tags', type: 'multi_select', options: ['low', 'high'] }, { id: 'checked', type: 'checkbox' }];
const rows = [
    { documentId: 'a', title: '문서 10', values: { cost: 0, tags: ['low'], checked: false } },
    { documentId: 'b', title: '문서 2', values: { cost: 15, tags: ['high'], checked: true } },
    { documentId: 'c', title: '문서 3', values: {} },
];
test('nested AND/OR filters evaluate typed values and list membership', () => {
    const filter = { conjunction: 'and', rules: [{ propertyId: 'cost', operator: 'greater_or_equal', value: 0 }, { conjunction: 'or', rules: [{ propertyId: 'tags', operator: 'contains', value: 'high' }, { propertyId: 'cost', operator: 'equals', value: 100 }] }] };
    assert.deepEqual(queryDatabaseRows(rows, properties, { filter }).map(r => r.documentId), ['b']);
});
test('unset checks preserve zero and false as actual values', () => {
    assert.deepEqual(queryDatabaseRows(rows, properties, { filter: { conjunction: 'and', rules: [{ propertyId: 'cost', operator: 'is_empty' }] } }).map(r => r.documentId), ['c']);
    assert.deepEqual(queryDatabaseRows(rows, properties, { filter: { conjunction: 'and', rules: [{ propertyId: 'checked', operator: 'equals', value: false }] } }).map(r => r.documentId), ['a']);
});
test('sorts honor numeric values, null placement and stable ties without mutating rows', () => {
    assert.deepEqual(queryDatabaseRows(rows, properties, { sorts: [{ propertyId: 'cost', direction: 'descending' }] }).map(r => r.documentId), ['b', 'a', 'c']);
    assert.deepEqual(rows.map(r => r.documentId), ['a', 'b', 'c']);
    assert.deepEqual(queryDatabaseRows(rows, properties, { sorts: [{ propertyId: 'title', direction: 'ascending' }] }).map(r => r.documentId), ['b', 'c', 'a']);
});
test('search includes property values', () => {
    assert.deepEqual(queryDatabaseRows(rows, properties, { search: 'HIGH' }).map(r => r.documentId), ['b']);
});
test('untrusted structures and excessive depth fail instead of hiding conditions', () => {
    assert.throws(() => validateDatabaseQuery({ filter: { conjunction: 'and', rules: [{ propertyId: '__proto__', operator: 'equals', value: 1 }] } }, properties));
    let filter = { conjunction: 'and', rules: [] };
    for (let i = 0; i < 4; i++) filter = { conjunction: 'and', rules: [filter] };
    assert.throws(() => validateDatabaseQuery({ filter }, properties));
    assert.throws(() => validateDatabaseQuery({ sorts: [{ propertyId: 'title', direction: 'random' }] }, properties));
});
