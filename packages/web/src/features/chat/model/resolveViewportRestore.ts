import type { ChannelViewportAnchor } from './channelViewportAnchor';

export type RestoreTarget = ({ kind: 'message' } & ChannelViewportAnchor) | { kind: 'unread'; after: string };

type MessagePosition = { id: string; createdAt: string; replyToId?: string | null };

export function resolveViewportRestore(
    target: RestoreTarget,
    messages: MessagePosition[],
    hasOlderMessages: boolean,
): { loadOlder: boolean; anchor: ChannelViewportAnchor | null } {
    const oldest = messages[0];
    if (target.kind === 'message') {
        if (messages.some((message) => message.id === target.messageId && !message.replyToId)) {
            return { loadOlder: false, anchor: target };
        }
        return {
            loadOlder: Boolean(
                hasOlderMessages && oldest && Date.parse(oldest.createdAt) > Date.parse(target.createdAt),
            ),
            anchor: null,
        };
    }
    // Reach the read boundary before choosing an unread message from a newer page.
    if (hasOlderMessages && oldest && Date.parse(oldest.createdAt) > Date.parse(target.after)) {
        return { loadOlder: true, anchor: null };
    }
    const unread = messages.find(
        (message) => !message.replyToId && Date.parse(message.createdAt) > Date.parse(target.after),
    );
    return {
        loadOlder: false,
        anchor: unread ? { messageId: unread.id, createdAt: unread.createdAt, offset: 0 } : null,
    };
}
