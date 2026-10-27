const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aggregateValues } = require('../dist');
test('rollups distinguish missing values from zero and false', () => {
    assert.equal(aggregateValues([null, undefined, '', [], 0, false], 'count_empty'), 4);
    assert.equal(aggregateValues([null, 0, false, 'x'], 'percent_not_empty'), .75);
    assert.equal(aggregateValues([], 'count'), 0);
    assert.equal(aggregateValues([], 'sum'), 0);
    assert.equal(aggregateValues([], 'average'), null);
});
test('original and unique values preserve primitive types and flatten lists', () => {
    assert.deepEqual(aggregateValues([['a', 'b'], ['a'], 0, false], 'show_unique'), ['a', 'b', 0, false]);
    assert.equal(aggregateValues([0, '0', 0], 'count_unique'), 2);
    assert.equal(aggregateValues([['a', 'b'], []], 'count_values'), 2);
});
test('statistical and date rollups respect source values', () => {
    assert.equal(aggregateValues([1, 9, 3, 5], 'median'), 4);
    assert.equal(aggregateValues([1, 9, 3, 5], 'range'), 8);
    assert.equal(aggregateValues(['2026-10-27', '2026-10-30'], 'date_range'), 3);
    assert.equal(aggregateValues(['2026-10-27', '2026-10-30'], 'earliest_date'), '2026-10-27');
});
