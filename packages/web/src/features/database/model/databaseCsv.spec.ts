import { it, expect } from 'vitest';
import { databaseCsv } from './databaseCsv';
import type { DatabaseRow } from './types';
it('CSV exports visible data with quoting, primitive types and inert spreadsheet text', () => {
    const row: DatabaseRow = {
        documentId: 'page',
        title: '회의, "보고"',
        canEdit: true,
        revision: 0,
        availablePersonIds: [],
        values: { text: '=1+1\n두 번째 줄', number: 0, check: false },
        relations: {},
    };
    expect(
        databaseCsv(
            [row],
            [
                { id: 'text', name: '메모', type: 'text' },
                { id: 'number', name: '수치', type: 'number' },
                { id: 'check', name: '완료', type: 'checkbox' },
            ],
            [],
        ),
    ).toBe('\uFEFF이름,메모,수치,완료\r\n"회의, ""보고""","\'=1+1\n두 번째 줄",0,false');
});
