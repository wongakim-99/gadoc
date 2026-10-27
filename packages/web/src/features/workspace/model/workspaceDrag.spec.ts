import { describe, it, expect } from 'vitest';
import {
    hasReferenceDrag,
    readReferenceDrag,
    insertReferenceAtSelection,
    WORKSPACE_REFERENCE_MIME,
} from './workspaceDrag';

describe('workspace drag boundary', () => {
    const origin = 'http://localhost:3002';
    const reference = { href: '/team/docs/doc', kind: 'docs', label: '문서' };
    const read = (payload: unknown) => readReferenceDrag({ getData: () => JSON.stringify(payload) }, 'team', origin);
    it('accepts local workspace references', () => {
        expect(read({ origin, reference })).toEqual(reference);
        const issue = { href: '/team/issues?issue=123', kind: 'issues', label: '이슈' };
        expect(read({ origin, reference: issue })).toEqual(issue);
    });
    it('rejects foreign origins, teams, mismatched kinds and oversized payloads', () => {
        expect(read({ origin: 'https://evil.test', reference })).toBeNull();
        expect(read({ origin, reference: { ...reference, href: '/other/docs/doc' } })).toBeNull();
        expect(read({ origin, reference: { ...reference, kind: 'issues' } })).toBeNull();
        expect(read({ origin, reference, excess: 'x'.repeat(4096) })).toBeNull();
        expect(readReferenceDrag({ getData: () => 'invalid' }, 'team', origin)).toBeNull();
    });
    it('leaves native file and text drag types alone', () => {
        expect(hasReferenceDrag({ types: ['Files', 'text/plain'] })).toBe(false);
        expect(hasReferenceDrag({ types: [WORKSPACE_REFERENCE_MIME] })).toBe(true);
    });
    it('inserts at the selection while retaining surrounding draft', () => {
        expect(
            insertReferenceAtSelection('앞뒤', '[문서](/team/docs/doc)', {
                selectionStart: 1,
                selectionEnd: 1,
            } as HTMLTextAreaElement),
        ).toBe('앞\n[문서](/team/docs/doc)\n뒤');
    });
});
