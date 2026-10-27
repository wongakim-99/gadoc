import { describe, it, expect } from 'vitest';
import { filterDefaults } from './filterDefaults';
import type { DatabaseProperty } from './types';
const props: DatabaseProperty[] = [
    { id: 'status', name: '상태', type: 'status', options: ['초안', '진행'] },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'number', name: '숫자', type: 'number' },
    { id: 'formula', name: '수식', type: 'formula' },
];
describe('new page filter defaults', () => {
    it('combines definite equality and list requirements including zero', () => {
        expect(
            filterDefaults(
                props,
                {
                    conjunction: 'and',
                    rules: [
                        { propertyId: 'number', operator: 'equals', value: 0 },
                        { propertyId: 'owner', operator: 'contains', value: 'second' },
                    ],
                },
                '진행',
                'first',
            ),
        ).toEqual({ number: 0, status: '진행', owner: ['second', 'first'] });
    });
    it('does not guess OR, range or computed values', () => {
        expect(
            filterDefaults(props, {
                conjunction: 'and',
                rules: [
                    { conjunction: 'or', rules: [{ propertyId: 'status', operator: 'equals', value: '진행' }] },
                    { propertyId: 'number', operator: 'greater_than', value: 10 },
                    { propertyId: 'formula', operator: 'equals', value: 5 },
                ],
            }),
        ).toEqual({});
    });
    it('omits contradictory assignments rather than picking a condition', () => {
        expect(
            filterDefaults(
                props,
                { conjunction: 'and', rules: [{ propertyId: 'status', operator: 'equals', value: '초안' }] },
                '진행',
            ),
        ).toEqual({});
    });
});
