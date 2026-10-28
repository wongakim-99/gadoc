const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveStatusGroups } = require('../dist');

test('status membership follows identity through rename and explicit reassignment', () => {
    const options = [{ id: 'a', name: '할 일' }, { id: 'b', name: '진행 중' }, { id: 'c', name: '완료' }];
    const initial = resolveStatusGroups(options);
    assert.deepEqual(initial.map(item => item.group), ['todo', 'in_progress', 'complete']);
    const renamed = options.map(option => option.id === 'b' ? { ...option, name: '검토' } : option);
    assert.deepEqual(resolveStatusGroups(renamed, initial), initial);
    assert.equal(resolveStatusGroups(renamed, initial, [{ name: '검토', group: 'complete' }])[1].group, 'complete');
});

test('new and unknown legacy statuses are not implicitly completed and removed IDs disappear', () => {
    assert.deepEqual(resolveStatusGroups([{ id: 'new', name: '대기' }], [{ optionId: 'removed', group: 'complete' }]), [{ optionId: 'new', group: 'todo' }]);
    assert.equal(resolveStatusGroups([{ id: 'renamed', name: '게시됨', legacyName: '완료' }])[0].group, 'complete');
});

test('rejects duplicate, foreign and invalid status assignments', () => {
    const options = [{ id: 'a', name: '검토' }];
    for (const assignments of [
        [{ name: '검토', group: 'todo' }, { name: '검토', group: 'complete' }],
        [{ name: '없는 옵션', group: 'todo' }],
        [{ name: '검토', group: 'unknown' }],
    ]) assert.throws(() => resolveStatusGroups(options, [], assignments));
});
