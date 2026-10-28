const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renameOptionIdentity, decodeOptionValue, encodeOptionValue } = require('../dist');

test('legacy selections survive rename and reuse of their original label', () => {
    const original = [{ id: 'option-1', name: 'Draft', legacyName: 'Draft' }];
    const renamed = renameOptionIdentity(original, 'option-1', 'Review');
    renamed.push({ id: 'option-2', name: 'Draft' });
    assert.equal(decodeOptionValue(renamed, 'Draft'), 'Review');
    assert.equal(decodeOptionValue(renamed, 'option-1'), 'Review');
    assert.equal(encodeOptionValue(renamed, 'Draft'), 'option-2');
    assert.equal(decodeOptionValue(renamed, 'option-2'), 'Draft');
    assert.equal(original[0].name, 'Draft');
    const again = renameOptionIdentity(renamed, 'option-1', 'Published');
    assert.equal(decodeOptionValue(again, 'Draft'), 'Published');
    assert.equal(decodeOptionValue(again, 'option-2'), 'Draft');
});

test('invalid renames and stale names cannot silently target another option', () => {
    const options = [{ id: 'a', name: 'A', legacyName: 'Old A' }, { id: 'b', name: 'B' }];
    for (const [id, name] of [['missing', 'X'], ['a', ' '], ['a', 'B'], ['a', 'x'.repeat(81)]])
        assert.throws(() => renameOptionIdentity(options, id, name));
    assert.throws(() => encodeOptionValue(options, 'Old A'));
    assert.equal(decodeOptionValue(options, 'unknown'), 'unknown');
});


test('saved nested filters retain identity when an old label is reused', () => {
    const { queryDatabaseRows } = require('../dist');
    const properties = [{ id: 'state', type: 'select', options: ['Review', 'Draft'], optionIdentities: [
        { id: 'original', name: 'Review', legacyName: 'Draft' },
        { id: 'new', name: 'Draft' },
    ] }];
    const rows = [
        { documentId: 'old', title: 'Keep', values: { state: 'Review' } },
        { documentId: 'new', title: 'Keep', values: { state: 'Draft' } },
    ];
    const query = (value) => ({ filter: { conjunction: 'and', rules: [
        { propertyId: 'title', operator: 'equals', value: 'Keep' },
        { conjunction: 'or', rules: [{ propertyId: 'state', operator: 'equals', value }] },
    ] } });
    assert.deepEqual(queryDatabaseRows(rows, properties, query('original')).map(r => r.documentId), ['old']);
    assert.deepEqual(queryDatabaseRows(rows, properties, query('Draft')).map(r => r.documentId), ['old']);
    assert.deepEqual(queryDatabaseRows(rows, properties, query('new')).map(r => r.documentId), ['new']);
});
