const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatDatabaseNumber } = require('../dist');
test('number presentation preserves zero, fractions and negative percentages', () => {
    assert.equal(formatDatabaseNumber(0, 'comma'), '0');
    assert.equal(formatDatabaseNumber(12345.6789, 'comma'), '12,345.6789');
    assert.equal(formatDatabaseNumber(-0.125, 'percent'), '-12.5%');
    assert.equal(formatDatabaseNumber(1000, 'KRW'), '₩1,000');
    assert.equal(formatDatabaseNumber(NaN, 'USD'), '');
});
