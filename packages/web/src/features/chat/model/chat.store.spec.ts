import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chat.store';
import type { Message } from '../../../entities/message/types';

const message = (id: string, patch: Partial<Message> = {}): Message => ({
    id,
    channelId: 'channel',
    teamId: 'team',
    authorId: 'author',
    content: id,
    type: 'text',
    attachments: [],
    reactions: [],
    mentions: [],
    replyToId: null,
    isEdited: false,
    isPinned: false,
    pinnedAt: null,
    createdAt: '2026-10-28T01:00:00.000Z',
    updatedAt: '2026-10-28T01:00:00.000Z',
    ...patch,
});

describe('chat history reconciliation', () => {
    beforeEach(() => useChatStore.getState().reset());
    it('deduplicates replies fetched while an older history page is in flight and preserves live updates', () => {
        const reply = message('reply', { replyToId: 'parent' });
        const oldPage = [message('parent'), reply];
        useChatStore.getState().setMessages([message('latest', { createdAt: '2026-10-28T02:00:00.000Z' })]);
        useChatStore
            .getState()
            .addMessage({
                ...reply,
                updatedAt: '2026-10-28T01:01:00.000Z',
                reactions: [{ emoji: '👍', userIds: ['actor'] }],
            });
        useChatStore.getState().prependMessages(oldPage);
        const messages = useChatStore.getState().messages;
        expect(messages.map((message) => message.id)).toEqual(['parent', 'reply', 'latest']);
        expect(messages.find((message) => message.id === 'reply')?.reactions).toEqual([
            { emoji: '👍', userIds: ['actor'] },
        ]);
    });
    it('keeps a newer history snapshot and reconciles equal-version duplicates without repeated rows', () => {
        useChatStore.getState().setMessages([message('same'), message('same')]);
        useChatStore
            .getState()
            .prependMessages([message('same', { updatedAt: '2026-10-28T01:02:00.000Z', content: 'newer' })]);
        expect(useChatStore.getState().messages).toEqual([
            message('same', { updatedAt: '2026-10-28T01:02:00.000Z', content: 'newer' }),
        ]);
    });
    it('replacing the initial channel page does not retain messages from the previous channel', () => {
        useChatStore.getState().setMessages([message('A')]);
        useChatStore.getState().setMessages([message('B', { channelId: 'other' })]);
        expect(useChatStore.getState().messages.map((message) => message.id)).toEqual(['B']);
    });
});
