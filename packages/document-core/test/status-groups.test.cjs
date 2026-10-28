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


test('status checkbox preserves canonical options and represents in-progress as mixed', () => {
    const { statusCheckboxState } = require('../dist');
    const options = [{ id:'a', name:'초안' }, { id:'b', name:'검토 중' }, { id:'c', name:'게시됨' }];
    assert.deepEqual(statusCheckboxState(options, undefined, '초안'), { checked:false, indeterminate:false, nextValue:'게시됨' });
    assert.deepEqual(statusCheckboxState(options, undefined, '검토 중'), { checked:false, indeterminate:true, nextValue:'게시됨' });
    assert.deepEqual(statusCheckboxState(options, undefined, '게시됨'), { checked:true, indeterminate:false, nextValue:'초안' });
    assert.equal(statusCheckboxState([{ id:'only', name:'초안' }], undefined, '초안').nextValue, undefined);
    const groups = resolveStatusGroups(options);
    const renamed = options.map(option => option.id === 'c' ? { ...option, name:'승인됨' } : option);
    assert.equal(statusCheckboxState(renamed, groups, '승인됨').checked, true);
});
