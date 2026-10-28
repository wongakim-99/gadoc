import { identitiesFor, reconcileOptionIdentities, optionDisplayValue, optionStoredValue } from './option-identities';
import type { DatabaseProperty } from './database.schema';

describe('option identity persistence boundary', () => {
    it('keeps legacy and new multi-select values through rename and name reuse', () => {
        const before: DatabaseProperty = { id: 'labels', name: 'Labels', type: 'multi_select', options: ['Draft', 'Ready'] };
        const first = identitiesFor(before);
        expect(identitiesFor(before)).toEqual(first);
        const stored = optionStoredValue(before, ['Draft', 'Ready']);
        const definitions = reconcileOptionIdentities(before, ['Review', 'Ready', 'Draft'], [{ id: first[0].id, name: 'Review' }]);
        const after = { ...before, options: definitions.map((item) => item.name), optionIdentities: definitions };
        expect(optionDisplayValue(after, stored)).toEqual(['Review', 'Ready']);
        expect(optionDisplayValue(after, ['Draft', 'Ready'])).toEqual(['Review', 'Ready']);
        expect(optionDisplayValue(after, optionStoredValue(after, ['Draft']))).toEqual(['Draft']);
        expect(optionStoredValue(after, ['Draft'])).not.toEqual([first[0].id]);
        expect(optionDisplayValue(after, null)).toBeNull();
    });
    it('rejects unknown/duplicate rename targets and leaves other property kinds intact', () => {
        const property: DatabaseProperty = { id: 'p', name: 'P', type: 'select', options: ['A', 'B'] };
        const id = identitiesFor(property)[0].id;
        expect(() => reconcileOptionIdentities(property, ['A'], [{ id: 'unknown', name: 'C' }])).toThrow();
        expect(() => reconcileOptionIdentities(property, ['A'], [{ id, name: 'C' }, { id, name: 'D' }])).toThrow();
        expect(() => optionStoredValue(property, 'unknown')).toThrow();
        expect(optionStoredValue({ ...property, type: 'text' }, 'A')).toBe('A');
    });
});
