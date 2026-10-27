export type FormulaValue = string | number | boolean | null | FormulaValue[];
type Node =
    | { kind: 'variable'; name: string }
    | { kind: 'value'; value: FormulaValue }
    | { kind: 'call'; name: string; args: Node[] }
    | { kind: 'binary'; op: string; left: Node; right: Node }
    | { kind: 'unary'; op: string; value: Node };
type Token = { text: string; value?: FormulaValue; kind: 'literal' | 'symbol' | 'name' };
const precedence: Record<string, number> = {
    or: 1,
    '||': 1,
    and: 2,
    '&&': 2,
    '==': 3,
    '!=': 3,
    '>': 4,
    '<': 4,
    '>=': 4,
    '<=': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6,
    '%': 6,
    '^': 7,
};
const functions = new Set([
    'map',
    'filter',
    'find',
    'findIndex',
    'every',
    'some',
    'let',
    'lets',
    'prop',
    'if',
    'ifs',
    'and',
    'or',
    'not',
    'empty',
    'length',
    'substring',
    'contains',
    'lower',
    'upper',
    'repeat',
    'format',
    'toNumber',
    'add',
    'subtract',
    'multiply',
    'divide',
    'mod',
    'pow',
    'min',
    'max',
    'sum',
    'median',
    'mean',
    'abs',
    'round',
    'ceil',
    'floor',
    'sqrt',
    'cbrt',
    'exp',
    'ln',
    'log10',
    'log2',
    'sign',
    'pi',
    'e',
    'join',
    'split',
    'first',
    'last',
    'at',
    'slice',
    'concat',
    'reverse',
    'sort',
    'unique',
    'includes',
    'flat',
    'now',
    'today',
    'timestamp',
    'fromTimestamp',
    'parseDate',
    'dateAdd',
    'dateSubtract',
    'dateBetween',
    'year',
    'month',
    'date',
    'day',
    'hour',
    'minute',
]);

export function parseFormula(source: string): { node: Node; references: string[] } {
    if (!source.trim() || source.length > 4000) throw new Error('수식은 1~4000자로 입력하세요.');
    const tokens: Token[] = [];
    let offset = 0;
    while (offset < source.length) {
        const rest = source.slice(offset);
        const whitespace = /^\s+/.exec(rest);
        if (whitespace) {
            offset += whitespace[0].length;
            continue;
        }
        const literal = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
        if (literal) {
            tokens.push({ kind: 'literal', text: literal[0], value: Number(literal[0]) });
            offset += literal[0].length;
            continue;
        }
        const quoted = /^"(?:[^"\\]|\\.)*"/.exec(rest);
        if (quoted) {
            tokens.push({ kind: 'literal', text: quoted[0], value: JSON.parse(quoted[0]) });
            offset += quoted[0].length;
            continue;
        }
        const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(rest);
        if (name) {
            const text = name[0];
            tokens.push(
                ['true', 'false', 'null'].includes(text)
                    ? { kind: 'literal', text, value: text === 'null' ? null : text === 'true' }
                    : { kind: 'name', text },
            );
            offset += text.length;
            continue;
        }
        const symbol = /^(==|!=|>=|<=|&&|\|\||[+\-*/%^!<>()\[\],.?:])/.exec(rest);
        if (!symbol) throw new Error(`${offset + 1}번째 문자에서 해석할 수 없습니다.`);
        tokens.push({ kind: 'symbol', text: symbol[0] });
        offset += symbol[0].length;
        if (tokens.length > 1500) throw new Error('수식이 너무 복잡합니다.');
    }
    let cursor = 0;
    const refs = new Set<string>();
    const peek = () => tokens[cursor]?.text;
    const expect = (text: string) => {
        if (peek() !== text) throw new Error(`'${text}'가 필요합니다.`);
        cursor++;
    };
    const call = (name: string, args: Node[]): Node => {
        if (name !== '__list' && !functions.has(name)) throw new Error(`지원하지 않는 함수: ${name}`);
        if (name === 'prop') {
            if (args.length !== 1 || args[0].kind !== 'value' || typeof args[0].value !== 'string')
                throw new Error('prop에는 속성 이름을 문자열로 입력하세요.');
            refs.add(args[0].value);
        }
        return { kind: 'call', name, args };
    };
    const args = (end: string, depth: number): Node[] => {
        const result: Node[] = [];
        if (peek() !== end) {
            do {
                result.push(expression(0, depth + 1));
                if (peek() !== ',') break;
                cursor++;
            } while (true);
        }
        expect(end);
        return result;
    };
    const expression = (minimum: number, depth: number): Node => {
        if (depth > 60) throw new Error('수식 중첩 한도를 초과했습니다.');
        const token = tokens[cursor++];
        if (!token) throw new Error('수식이 완성되지 않았습니다.');
        let left: Node;
        if (token.kind === 'literal') left = { kind: 'value', value: token.value! };
        else if (token.text === '(') {
            left = expression(0, depth + 1);
            expect(')');
        } else if (token.text === '[') left = call('__list', args(']', depth));
        else if (['!', '-', '+'].includes(token.text) || (token.text === 'not' && peek() !== '('))
            left = { kind: 'unary', op: token.text, value: expression(7, depth + 1) };
        else if (token.kind === 'name') {
            if (peek() === '(') {
                cursor++;
                left = call(token.text, args(')', depth));
            } else left = { kind: 'variable', name: token.text };
        } else throw new Error(`예상하지 못한 기호: ${token.text}`);
        while (true) {
            if (peek() === '.') {
                cursor++;
                const name = tokens[cursor++];
                if (!name || name.kind !== 'name' || name.text === 'prop') throw new Error('올바른 함수를 입력하세요.');
                expect('(');
                left = call(name.text, [left, ...args(')', depth)]);
                continue;
            }
            const op = peek();
            if (!op || precedence[op] === undefined || precedence[op] < minimum) break;
            cursor++;
            left = { kind: 'binary', op, left, right: expression(precedence[op] + (op === '^' ? 0 : 1), depth + 1) };
        }
        if (minimum === 0 && peek() === '?') {
            cursor++;
            const yes = expression(0, depth + 1);
            expect(':');
            left = call('if', [left, yes, expression(0, depth + 1)]);
        }
        return left;
    };
    const node = expression(0, 0);
    if (cursor !== tokens.length) throw new Error(`예상하지 못한 기호: ${peek()}`);
    return { node, references: [...refs] };
}

const number = (value: FormulaValue) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('숫자 값이 필요합니다.');
    return value;
};
const text = (value: FormulaValue): string =>
    value === null ? '' : Array.isArray(value) ? value.map(text).join(', ') : String(value);
const list = (value: FormulaValue): FormulaValue[] => {
    if (!Array.isArray(value)) throw new Error('목록이 필요합니다.');
    return value;
};
const dateValue = (value: FormulaValue): Date => {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('날짜 값이 필요합니다.');
    return new Date(value);
};
const equals = (a: FormulaValue, b: FormulaValue) => JSON.stringify(a) === JSON.stringify(b);

export function evaluateFormula(node: Node, property: (name: string) => FormulaValue, now = new Date()): FormulaValue {
    let steps = 0;
    const evaluate = (n: Node, depth = 0, scope = new Map<string, FormulaValue>()): FormulaValue => {
        if (++steps > 5000 || depth > 100) throw new Error('수식 계산 한도를 초과했습니다.');
        const run = (child: Node) => evaluate(child, depth + 1, scope);
        if (n.kind === 'value') return n.value;
        if (n.kind === 'variable') {
            if (!scope.has(n.name)) throw new Error(`정의되지 않은 변수: ${n.name}`);
            return scope.get(n.name)!;
        }
        if (n.kind === 'unary') {
            const v = run(n.value);
            return n.op === '!' || n.op === 'not' ? !v : n.op === '-' ? -number(v) : number(v);
        }
        if (n.kind === 'binary') {
            const a = run(n.left);
            if (n.op === 'and' || n.op === '&&') return Boolean(a) && Boolean(run(n.right));
            if (n.op === 'or' || n.op === '||') return Boolean(a) || Boolean(run(n.right));
            const b = run(n.right);
            if (n.op === '==') return equals(a, b);
            if (n.op === '!=') return !equals(a, b);
            if (['>', '<', '>=', '<='].includes(n.op)) {
                if ((typeof a !== 'number' && typeof a !== 'string') || typeof a !== typeof b)
                    throw new Error('같은 형식끼리 비교하세요.');
                const comparison = typeof a === 'number' ? a - (b as number) : a === b ? 0 : a > (b as string) ? 1 : -1;
                return n.op === '>'
                    ? comparison > 0
                    : n.op === '<'
                      ? comparison < 0
                      : n.op === '>='
                        ? comparison >= 0
                        : comparison <= 0;
            }
            if (n.op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
            const x = number(a),
                y = number(b);
            if ((n.op === '/' || n.op === '%') && y === 0) throw new Error('0으로 나눌 수 없습니다.');
            return n.op === '+'
                ? x + y
                : n.op === '-'
                  ? x - y
                  : n.op === '*'
                    ? x * y
                    : n.op === '/'
                      ? x / y
                      : n.op === '%'
                        ? x % y
                        : x ** y;
        }
        if (n.name === 'let' || n.name === 'lets') {
            if (n.args.length < 3 || n.args.length % 2 !== 1 || (n.name === 'let' && n.args.length !== 3))
                throw new Error('변수 이름과 값, 마지막 결과 식을 입력하세요.');
            const local = new Map(scope);
            for (let i = 0; i < n.args.length - 1; i += 2) {
                const variable = n.args[i];
                if (variable.kind !== 'variable') throw new Error('변수 이름이 필요합니다.');
                local.set(variable.name, evaluate(n.args[i + 1], depth + 1, local));
            }
            return evaluate(n.args[n.args.length - 1], depth + 1, local);
        }
        if (['map', 'filter', 'find', 'findIndex', 'every', 'some'].includes(n.name)) {
            if (n.args.length !== 2) throw new Error('목록과 항목별 계산식이 필요합니다.');
            const input = list(run(n.args[0]));
            const item = (current: FormulaValue, index: number) => {
                const local = new Map(scope);
                local.set('current', current);
                local.set('index', index);
                return evaluate(n.args[1], depth + 1, local);
            };
            if (n.name === 'map') return input.map(item);
            if (n.name === 'filter') return input.filter((value, index) => Boolean(item(value, index)));
            if (n.name === 'find') return input.find((value, index) => Boolean(item(value, index))) ?? null;
            if (n.name === 'findIndex') return input.findIndex((value, index) => Boolean(item(value, index)));
            if (n.name === 'every') return input.every((value, index) => Boolean(item(value, index)));
            return input.some((value, index) => Boolean(item(value, index)));
        }
        if (n.name === 'prop') return property((n.args[0] as { value: string }).value);
        if (n.name === 'if') {
            if (n.args.length !== 3) throw new Error('if에는 인수 3개가 필요합니다.');
            return run(n.args[0]) ? run(n.args[1]) : run(n.args[2]);
        }
        if (n.name === 'ifs') {
            for (let i = 0; i + 1 < n.args.length; i += 2) if (run(n.args[i])) return run(n.args[i + 1]);
            return n.args.length % 2 ? run(n.args[n.args.length - 1]) : null;
        }
        if (n.name === 'and') return n.args.every((arg) => Boolean(run(arg)));
        if (n.name === 'or') return n.args.some((arg) => Boolean(run(arg)));
        const a = n.args.map(run),
            v = a[0] ?? null;
        const nums = () => a.flat(Infinity as 1).map(number);
        switch (n.name) {
            case '__list':
                return a;
            case 'not':
                return !v;
            case 'empty':
                return v === null || v === '' || v === 0 || v === false || (Array.isArray(v) && !v.length);
            case 'length':
                return Array.isArray(v) ? v.length : text(v).length;
            case 'format':
                return text(v);
            case 'toNumber': {
                const result = Number(text(v));
                if (!Number.isFinite(result)) throw new Error('숫자로 변환할 수 없습니다.');
                return result;
            }
            case 'lower':
                return text(v).toLowerCase();
            case 'upper':
                return text(v).toUpperCase();
            case 'substring':
                return text(v).slice(number(a[1]), a[2] === undefined ? undefined : number(a[2]));
            case 'contains':
                return text(v).includes(text(a[1]));
            case 'repeat': {
                const count = number(a[1]);
                if (count < 0 || count > 10000 || text(v).length * count > 10000)
                    throw new Error('반복 길이를 초과했습니다.');
                return text(v).repeat(count);
            }
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
            case 'mod':
            case 'pow':
                return run({
                    kind: 'binary',
                    op: { add: '+', subtract: '-', multiply: '*', divide: '/', mod: '%', pow: '^' }[n.name],
                    left: { kind: 'value', value: v },
                    right: { kind: 'value', value: a[1] },
                });
            case 'sum':
                return nums().reduce((x, y) => x + y, 0);
            case 'min':
                return Math.min(...nums());
            case 'max':
                return Math.max(...nums());
            case 'mean': {
                const values = nums();
                return values.length ? values.reduce((x, y) => x + y, 0) / values.length : null;
            }
            case 'median': {
                const values = nums().sort((x, y) => x - y),
                    mid = Math.floor(values.length / 2);
                return !values.length ? null : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
            }
            case 'round': {
                const factor = 10 ** (a[1] === undefined ? 0 : number(a[1]));
                return Math.round(number(v) * factor) / factor;
            }
            case 'abs':
            case 'ceil':
            case 'floor':
            case 'sqrt':
            case 'cbrt':
            case 'exp':
            case 'log10':
            case 'log2':
            case 'sign':
                return Math[n.name](number(v));
            case 'ln':
                return Math.log(number(v));
            case 'pi':
                return Math.PI;
            case 'e':
                return Math.E;
            case 'split':
                return text(v).split(text(a[1]));
            case 'join':
                return list(v).map(text).join(text(a[1]));
            case 'first':
                return list(v)[0] ?? null;
            case 'last':
                return list(v).at(-1) ?? null;
            case 'at':
                return list(v).at(number(a[1])) ?? null;
            case 'slice':
                return list(v).slice(number(a[1]), a[2] === undefined ? undefined : number(a[2]));
            case 'concat':
                return a.flatMap(list);
            case 'reverse':
                return [...list(v)].reverse();
            case 'sort':
                return [...list(v)].sort((x, y) =>
                    typeof x === 'number' && typeof y === 'number' ? x - y : text(x).localeCompare(text(y)),
                );
            case 'flat':
                return list(v).flat();
            case 'unique':
                return list(v).filter((x, i, all) => all.findIndex((y) => equals(x, y)) === i);
            case 'includes':
                return list(v).some((x) => equals(x, a[1]));
            case 'now':
                return now.toISOString();
            case 'today':
                return now.toISOString().slice(0, 10);
            case 'parseDate':
                return dateValue(v).toISOString();
            case 'timestamp':
                return dateValue(v).getTime();
            case 'fromTimestamp':
                return new Date(number(v)).toISOString();
            case 'year':
                return dateValue(v).getUTCFullYear();
            case 'month':
                return dateValue(v).getUTCMonth() + 1;
            case 'date':
                return dateValue(v).getUTCDate();
            case 'day':
                return dateValue(v).getUTCDay() || 7;
            case 'hour':
                return dateValue(v).getUTCHours();
            case 'minute':
                return dateValue(v).getUTCMinutes();
            case 'dateAdd':
            case 'dateSubtract': {
                const result = dateValue(v),
                    amount = number(a[1]) * (n.name === 'dateSubtract' ? -1 : 1),
                    unit = text(a[2]);
                const scale: Record<string, number> = {
                    minutes: 60000,
                    hours: 3600000,
                    days: 86400000,
                    weeks: 604800000,
                };
                if (scale[unit]) result.setTime(result.getTime() + amount * scale[unit]);
                else if (unit === 'months' || unit === 'quarters')
                    result.setUTCMonth(result.getUTCMonth() + amount * (unit === 'quarters' ? 3 : 1));
                else if (unit === 'years') result.setUTCFullYear(result.getUTCFullYear() + amount);
                else throw new Error('지원하지 않는 날짜 단위입니다.');
                return result.toISOString();
            }
            case 'dateBetween': {
                const scale: Record<string, number> = {
                    minutes: 60000,
                    hours: 3600000,
                    days: 86400000,
                    weeks: 604800000,
                };
                const unit = text(a[2]);
                if (!scale[unit]) throw new Error('지원하지 않는 날짜 단위입니다.');
                return Math.trunc((dateValue(v).getTime() - dateValue(a[1]).getTime()) / scale[unit]);
            }
            default:
                throw new Error(`지원하지 않는 함수: ${n.name}`);
        }
    };
    const value = evaluate(node);
    const check = (v: FormulaValue) => {
        if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('유한한 계산 결과가 아닙니다.');
        if (Array.isArray(v)) v.forEach(check);
    };
    check(value);
    if (JSON.stringify(value).length > 20000) throw new Error('수식 결과가 너무 큽니다.');
    return value;
}
