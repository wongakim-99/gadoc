import { describe, expect, it } from 'vitest';
import { resolveViewportRestore } from './resolveViewportRestore';

const message = (day: number) => ({ id: `m${day}`, createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z` });

describe('viewport restoration', () => {
    it('loads back to the read boundary before selecting the first unread message', () => {
        const target = { kind: 'unread' as const, after: message(2).createdAt };
        expect(resolveViewportRestore(target, [message(8), message(9)], true).loadOlder).toBe(true);
        expect(
            resolveViewportRestore(target, [message(1), message(2), message(3), message(8)], true).anchor?.messageId,
        ).toBe('m3');
    });

    it('restores the saved message and its exact viewport offset', () => {
        const target = { kind: 'message' as const, messageId: 'm2', createdAt: message(2).createdAt, offset: -31 };
        expect(resolveViewportRestore(target, [message(8)], true).loadOlder).toBe(true);
        expect(resolveViewportRestore(target, [message(2), message(8)], true).anchor?.offset).toBe(-31);
    });

    it('finishes with a latest fallback when a saved message was deleted or history is exhausted', () => {
        const target = { kind: 'message' as const, messageId: 'deleted', createdAt: message(2).createdAt };
        expect(resolveViewportRestore(target, [message(1), message(3)], true)).toEqual({
            loadOlder: false,
            anchor: null,
        });
        expect(resolveViewportRestore(target, [], false)).toEqual({ loadOlder: false, anchor: null });
    });

    it('skips replies and resolves an exhausted unread boundary without looping', () => {
        const target = { kind: 'unread' as const, after: message(2).createdAt };
        expect(
            resolveViewportRestore(target, [{ ...message(3), replyToId: 'parent' }, message(4)], false).anchor
                ?.messageId,
        ).toBe('m4');
        expect(resolveViewportRestore(target, [], false)).toEqual({ loadOlder: false, anchor: null });
    });
});
