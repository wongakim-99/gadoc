import { evaluateFormula, parseFormula } from './formula';

const calculate = (expression: string, values: Record<string, number | string | null> = {}) =>
    evaluateFormula(
        parseFormula(expression).node,
        (name) => {
            if (!(name in values)) throw new Error('missing property');
            return values[name];
        },
        new Date('2026-10-27T12:00:00.000Z'),
    );

describe('bounded database formula evaluator', () => {
    it('parses precedence, exponent associativity, unary signs and property references', () => {
        expect(calculate('prop("예산") * 1.1 + 2 ^ 3 ^ 2', { 예산: 100 })).toBe(622);
        expect(calculate('-(2 + 3)')).toBe(-5);
        expect(parseFormula('prop("금액") + prop("금액")').references).toEqual(['금액']);
    });
    it('short circuits branches so unused invalid values do not fail', () => {
        expect(calculate('if(prop("수량") == 0, 0, 12 / prop("수량"))', { 수량: 0 })).toBe(0);
        expect(calculate('false and prop("missing")')).toBe(false);
        expect(calculate('true ? "진행" : prop("missing")')).toBe('진행');
        expect(calculate('ifs(false, 1, true, 2, 3)')).toBe(2);
    });
    it('handles lists, chain calls and aggregates without mutating input', () => {
        expect(calculate('[3, 1, 3, 2].unique().sort().join(",")')).toBe('1,2,3');
        expect(calculate('sum([1,2], 3)')).toBe(6);
        expect(calculate('median([3, 1, 2, 4])')).toBe(2.5);
        expect(calculate('"Hello".lower().contains("ell")')).toBe(true);
    });
    it('evaluates deterministic date arithmetic with a supplied clock', () => {
        expect(calculate('today()')).toBe('2026-10-27');
        expect(calculate('dateBetween(dateAdd("2026-10-27", 3, "days"), "2026-10-27", "days")')).toBe(3);
        expect(calculate('day("2026-10-25")')).toBe(7);
    });
    it('rejects executable code, dynamic property access and invalid calculations', () => {
        for (const source of [
            'globalThis.process.exit()',
            'constructor("return process")()',
            'prop("x")["constructor"]',
            '1;2',
            '1 +',
            'prop(12)',
        ])
            expect(() => calculate(source)).toThrow();
        expect(() => calculate('1 / 0')).toThrow('0으로');
        expect(() => calculate('sqrt(-1)')).toThrow();
        expect(() => calculate('repeat("x", 1000000)')).toThrow();
        expect(() => calculate('('.repeat(100) + '1' + ')'.repeat(100))).toThrow();
    });
    it('distinguishes equality types and the documented formula empty behavior', () => {
        expect(calculate('0 == "0"')).toBe(false);
        expect(calculate('empty(0)')).toBe(true);
        expect(calculate('empty([])')).toBe(true);
        expect(calculate('round(12.345, 2)')).toBe(12.35);
    });
});

describe('formula list scopes', () => {
    const run = (source: string) => evaluateFormula(parseFormula(source).node, () => null);
    it('evaluates map/filter with current and index without leaking scopes', () => {
        expect(run('[1, 2, 3].map(current * 2 + index).filter(current > 3)')).toEqual([5, 8]);
        expect(run('[[1,2],[3]].map(current.map(current * 2)).flat()')).toEqual([2, 4, 6]);
        expect(() => run('[1].map(current) + current')).toThrow('정의되지 않은 변수');
    });
    it('binds variables sequentially and restores shadowed variables', () => {
        expect(run('lets(x, 2, y, x + 3, x * y)')).toBe(10);
        expect(run('let(x, 3, let(x, 5, x) + x)')).toBe(8);
        expect(() => run('let("x", 3, 4)')).toThrow('변수 이름');
    });
    it('short circuits list predicates and reports invalid variables', () => {
        expect(run('[1,2,3].find(current > 1)')).toBe(2);
        expect(run('[1,2,3].findIndex(current > 1)')).toBe(1);
        expect(run('[1,2,3].every(current > 0)')).toBe(true);
        expect(run('[1,0].some(1/current > 0)')).toBe(true);
        expect(() => run('constructor')).toThrow('정의되지 않은 변수');
    });
});
