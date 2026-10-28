const { test } = require('node:test');
const assert = require('node:assert/strict');
const { numberProgress } = require('../dist');
test('progress clamps only its visual ratio and rejects absent or invalid values', () => {
    assert.equal(numberProgress(25, 50), .5);
    assert.equal(numberProgress(0, 100), 0);
    assert.equal(numberProgress(-25, 100), 0);
    assert.equal(numberProgress(150, 100), 1);
    assert.equal(numberProgress(.25, 1), .25);
    for (const value of [null, undefined, '', '25', NaN, Infinity]) assert.equal(numberProgress(value, 100), null);
    for (const divisor of [0, -1, NaN, Infinity]) assert.equal(numberProgress(25, divisor), null);
});
