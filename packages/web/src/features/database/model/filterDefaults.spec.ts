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


describe('status category defaults', () => {
    const properties: DatabaseProperty[] = [{ id: 'status', name: '상태', type: 'status', options: ['준비', '검토', '수정'],
        optionIdentities: [{ id: 'a', name: '준비' }, { id: 'b', name: '검토' }, { id: 'c', name: '수정' }],
        statusOptionGroups: [{ optionId: 'a', group: 'todo' }, { optionId: 'b', group: 'in_progress' }, { optionId: 'c', group: 'in_progress' }],
    }];
    it('uses the first matching option unless a more specific compatible option is selected', () => {
        const filter = { conjunction: 'and' as const, rules: [{ propertyId: 'status', operator: 'status_group_is' as const, value: 'in_progress' }] };
        expect(filterDefaults(properties, filter)).toEqual({ status: '검토' });
        expect(filterDefaults(properties, filter, '수정')).toEqual({ status: '수정' });
        expect(filterDefaults(properties, filter, '준비')).toEqual({});
        expect(filterDefaults(properties, { ...filter, rules: [...filter.rules, { propertyId: 'status', operator: 'equals', value: 'c' }] })).toEqual({ status: '수정' });
    });
    it('does not infer a value from contradictory categories or OR groups', () => {
        expect(filterDefaults(properties, { conjunction: 'and', rules: [
            { propertyId: 'status', operator: 'status_group_is', value: 'todo' },
            { propertyId: 'status', operator: 'status_group_is', value: 'in_progress' },
        ] })).toEqual({});
        expect(filterDefaults(properties, { conjunction: 'or', rules: [{ propertyId: 'status', operator: 'status_group_is', value: 'in_progress' }] })).toEqual({});
    });
});
