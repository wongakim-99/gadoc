import {describe,it,expect} from 'vitest';
import {parseDatabaseCsv,csvCell} from './parseDatabaseCsv';
describe('CSV import',()=>{
    it('preserves quoted commas, newlines, escaped quotes and trailing empty cells',()=>{
        expect(parseDatabaseCsv('\uFEFFName,Text,Empty\r\n"A,B","line 1\n""line 2""",\r\n')).toEqual([['Name','Text','Empty'],['A,B','line 1\n"line 2"','']]);
    });
    it('rejects malformed CSV before creating pages',()=>{
        for(const csv of ['name,value\na','name,value\n"a,b','name,value\n"a"z,b'])expect(()=>parseDatabaseCsv(csv)).toThrow();
    });
    it('validates types without evaluating spreadsheet formulas or coercing blank numbers to zero',()=>{
        const number={id:'n',name:'Amount',type:'number' as const};
        expect(csvCell('',number)).toBeNull();expect(csvCell('0',number)).toBe(0);
        expect(()=>csvCell('=1+2',number)).toThrow();
        expect(csvCell('=1+2',{...number,type:'text'})).toBe('=1+2');
        expect(csvCell('false',{...number,type:'checkbox'})).toBe(false);
        expect(()=>csvCell('unknown',{...number,type:'select',options:['known']})).toThrow();
    });
});
