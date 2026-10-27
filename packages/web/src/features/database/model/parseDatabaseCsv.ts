import type { DatabaseProperty, PropertyValue } from './types';
export function parseDatabaseCsv(input: string): string[][] {
    if (input.length > 1_000_000) throw new Error('CSV는 1MB 이하로 선택하세요.');
    const source = input.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let row: string[] = [],
        cell = '',
        quoted = false,
        closed = false;
    const pushCell = () => {
        row.push(cell);
        cell = '';
        closed = false;
        if (row.length > 501) throw new Error('CSV 열은 최대 501개입니다.');
    };
    const pushRow = () => {
        pushCell();
        if (row.some((value) => value !== '')) rows.push(row);
        row = [];
        if (rows.length > 1001) throw new Error('한 번에 최대 1,000행을 가져올 수 있습니다.');
    };
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quoted) {
            if (char === '"') {
                if (source[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = false;
                    closed = true;
                }
            } else cell += char;
            continue;
        }
        if (char === ',') {
            pushCell();
            continue;
        }
        if (char === '\r' || char === '\n') {
            if (char === '\r' && source[i + 1] === '\n') i++;
            pushRow();
            continue;
        }
        if (closed) throw new Error('닫는 따옴표 뒤의 구분자를 확인하세요.');
        if (char === '"') {
            if (cell) throw new Error('필드 안의 따옴표를 두 번 입력하세요.');
            quoted = true;
        } else cell += char;
    }
    if (quoted) throw new Error('닫히지 않은 따옴표가 있습니다.');
    if (cell || row.length || closed) pushRow();
    if (rows.length < 2) throw new Error('헤더와 데이터 행이 필요합니다.');
    if (rows.some((row) => row.length !== rows[0].length)) throw new Error('모든 행의 열 개수가 헤더와 같아야 합니다.');
    return rows;
}
export const csvWritable = (property: DatabaseProperty) =>
    !property.reverseOf &&
    ['text', 'number', 'date', 'checkbox', 'url', 'email', 'phone', 'status', 'select', 'multi_select'].includes(
        property.type,
    );
export function csvCell(value: string, property: DatabaseProperty): PropertyValue {
    if (!csvWritable(property)) throw new Error('이 속성은 CSV에서 직접 지정할 수 없습니다.');
    if (value === '') return null;
    if (property.type === 'number') {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error('숫자를 확인하세요.');
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error('유한한 숫자가 필요합니다.');
        return number;
    }
    if (property.type === 'checkbox') {
        if (['true', 'yes', '1', '예'].includes(value.trim().toLowerCase())) return true;
        if (['false', 'no', '0', '아니오'].includes(value.trim().toLowerCase())) return false;
        throw new Error('체크박스는 true 또는 false를 입력하세요.');
    }
    if (property.type === 'date' && !Number.isFinite(Date.parse(value))) throw new Error('날짜를 확인하세요.');
    if (['select', 'status'].includes(property.type) && !property.options?.includes(value))
        throw new Error('등록된 선택 옵션과 일치하지 않습니다.');
    if (property.type === 'multi_select') {
        const values = [
            ...new Set(
                value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
            ),
        ];
        if (values.some((item) => !property.options?.includes(item)))
            throw new Error('등록된 다중 선택 옵션과 일치하지 않습니다.');
        return values;
    }
    return value;
}
