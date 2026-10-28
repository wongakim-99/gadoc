import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearSentMessageDraft,
    draftContent,
    messageDraftKey,
    readMessageDraft,
    writeMessageDraft,
} from './messageDraft';

describe('message drafts', () => {
    const scope = { userId: 'user', teamId: 'team', channelId: 'channel' };
    const key = messageDraftKey(scope);
    beforeEach(() => {
        const storage = new Map<string, string>();
        vi.stubGlobal('window', {
            sessionStorage: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => storage.set(key, value),
                removeItem: (key: string) => storage.delete(key),
            },
            dispatchEvent: vi.fn(),
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('retains exact whitespace and isolates users, teams, channels and threads', () => {
        writeMessageDraft(key, '  unfinished\n@member ');
        expect(draftContent(readMessageDraft(key))).toBe('  unfinished\n@member ');
        for (const other of [{ userId: 'other' }, { teamId: 'other' }, { channelId: 'other' }, { threadId: 'reply' }]) {
            expect(draftContent(readMessageDraft(messageDraftKey({ ...scope, ...other })))).toBe('');
        }
    });

    it('clears a successfully sent snapshot but preserves edits made during sending', () => {
        writeMessageDraft(key, 'first');
        const sent = readMessageDraft(key);
        writeMessageDraft(key, 'next');
        clearSentMessageDraft(key, sent);
        expect(draftContent(readMessageDraft(key))).toBe('next');
        clearSentMessageDraft(key, readMessageDraft(key));
        expect(draftContent(readMessageDraft(key))).toBe('');
    });

    it('does not erase a new revision even when its text matches the sent text', () => {
        writeMessageDraft(key, 'same');
        const sent = readMessageDraft(key);
        writeMessageDraft(key, '');
        writeMessageDraft(key, 'same');
        clearSentMessageDraft(key, sent);
        expect(draftContent(readMessageDraft(key))).toBe('same');
    });

    it('tolerates corrupt storage and blocked storage', () => {
        expect(draftContent('{broken')).toBe('');
        window.sessionStorage.setItem = () => {
            throw new Error('blocked');
        };
        window.sessionStorage.getItem = () => {
            throw new Error('blocked');
        };
        writeMessageDraft(key, 'recoverable');
        expect(draftContent(readMessageDraft(key))).toBe('recoverable');
        clearSentMessageDraft(key, readMessageDraft(key));
    });

    it('keeps the latest edit if quota fails while an older stored draft remains', () => {
        writeMessageDraft(key, 'old');
        window.sessionStorage.setItem = () => {
            throw new Error('quota');
        };
        writeMessageDraft(key, 'latest');
        expect(draftContent(readMessageDraft(key))).toBe('latest');
        clearSentMessageDraft(key, readMessageDraft(key));
    });
});
