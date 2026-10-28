const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryDatabaseRows, validateDatabaseQuery } = require('../dist');
const property = { id: 'status', type: 'status', options: ['대기', '검토', '수정', '게시'], optionIdentities: [
    {id:'a',name:'대기',legacyName:'todo'}, {id:'b',name:'검토'}, {id:'c',name:'수정'}, {id:'d',name:'게시'},
], statusOptionGroups: [
    {optionId:'a',group:'todo'}, {optionId:'b',group:'in_progress'}, {optionId:'c',group:'in_progress'}, {optionId:'d',group:'complete'},
] };
const rows = ['대기','검토','수정','게시',null].map((value,index)=>({documentId:String(index),title:'Row',values:{status:value}}));
const rule = (operator,value) => ({propertyId:'status',operator,value});
const query = (...rules) => ({filter:{conjunction:'and',rules}});
test('group filters include all members and keep category IDs independent of historical option names', () => {
    assert.deepEqual(queryDatabaseRows(rows,[property],query(rule('status_group_is','in_progress'))).map(row=>row.documentId),['1','2']);
    assert.deepEqual(queryDatabaseRows(rows,[property],query(rule('status_group_is','todo'))).map(row=>row.documentId),['0']);
    assert.deepEqual(queryDatabaseRows(rows,[property],query(rule('status_group_is_not','complete'))).map(row=>row.documentId),['0','1','2','4']);
});
test('nested queries follow renamed option identity and current group assignment', () => {
    const updated={...property,options:['대기','승인 검토','수정','게시'],optionIdentities:property.optionIdentities.map(option=>option.id==='b'?{...option,name:'승인 검토'}:option)};
    const updatedRows=rows.map(row=>row.documentId==='1'?{...row,values:{status:'승인 검토'}}:row);
    assert.deepEqual(queryDatabaseRows(updatedRows,[updated],query({conjunction:'or',rules:[rule('status_group_is','in_progress'),rule('equals','d')]})).map(row=>row.documentId),['1','2','3']);
});
test('group query rejects non-status properties and arbitrary category values', () => {
    assert.throws(()=>validateDatabaseQuery(query(rule('status_group_is','other')),[property]));
    assert.throws(()=>validateDatabaseQuery(query(rule('status_group_is','todo')),[{...property,type:'select'}]));
});
