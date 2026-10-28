import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readChannelViewportAnchor, writeChannelViewportAnchor } from './channelViewportAnchor';

describe('channelViewportAnchor', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('isolates accounts and preserves viewport offset and bottom state', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('window', {
            sessionStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => store.set(key, value),
            },
        });
        const anchor = { messageId: 'm', createdAt: '2026-10-01T00:00:00Z', offset: -23, atBottom: false };
        writeChannelViewportAnchor('t', 'c', anchor, 'u1');
        expect(readChannelViewportAnchor('t', 'c', 'u1')).toEqual(anchor);
        expect(readChannelViewportAnchor('t', 'c', 'u2')).toBeNull();
        expect(readChannelViewportAnchor('other', 'c', 'u1')).toBeNull();
        expect(readChannelViewportAnchor('t', 'other', 'u1')).toBeNull();
    });

    it('ignores corrupt and inaccessible storage without breaking scrolling', () => {
        vi.stubGlobal('window', {
            sessionStorage: {
                getItem: () => '{bad json',
                setItem: () => {
                    throw new Error('quota');
                },
                removeItem: () => {
                    throw new Error('denied');
                },
            },
        });
        expect(readChannelViewportAnchor('t', 'c', 'u')).toBeNull();
        expect(() => writeChannelViewportAnchor('t', 'c', { messageId: 'm', createdAt: 'now' }, 'u')).not.toThrow();
        expect(() => writeChannelViewportAnchor('t', 'c', null, 'u')).not.toThrow();
    });

    it('sessionStorage에 저장한 anchor를 다시 읽는다', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('window', {
            sessionStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                removeItem: (key: string) => {
                    store.delete(key);
                },
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
            },
        });

        writeChannelViewportAnchor('team-1', 'channel-1', {
            messageId: 'message-1',
            createdAt: '2026-04-16T02:20:00.000Z',
        });

        expect(readChannelViewportAnchor('team-1', 'channel-1')).toEqual({
            messageId: 'message-1',
            createdAt: '2026-04-16T02:20:00.000Z',
        });
    });

    it('anchor를 null로 저장하면 sessionStorage에서 제거한다', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('window', {
            sessionStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                removeItem: (key: string) => {
                    store.delete(key);
                },
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
            },
        });

        writeChannelViewportAnchor('team-1', 'channel-1', {
            messageId: 'message-1',
            createdAt: '2026-04-16T02:20:00.000Z',
        });
        writeChannelViewportAnchor('team-1', 'channel-1', null);

        expect(readChannelViewportAnchor('team-1', 'channel-1')).toBeNull();
    });
});
