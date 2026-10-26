import { getDocumentAncestors } from './getDocumentAncestors';
import type { DocumentNode } from '../types';

const node = (id: string, parentId: string | null) => ({ id, parentId, title: id }) as DocumentNode;

describe('getDocumentAncestors', () => {
    it('orders visible ancestors from root to parent', () => {
        expect(getDocumentAncestors([node('a', null), node('b', 'a'), node('c', 'b')], 'c').map((d) => d.id)).toEqual([
            'a',
            'b',
        ]);
    });
    it('stops at unavailable parents', () => {
        expect(getDocumentAncestors([node('c', 'restricted')], 'c')).toEqual([]);
    });
    it('terminates on cyclic parents without including itself', () => {
        expect(getDocumentAncestors([node('a', 'b'), node('b', 'a')], 'a').map((d) => d.id)).toEqual(['b']);
    });
});
