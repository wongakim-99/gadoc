import { expect, it } from 'vitest';
import type { AppNotification } from '../types';
import { resolveNotificationHref } from './resolveNotificationHref';

it('keeps the exact reply/message target even when already viewing the same channel', () => {
    const notification = {
        resourceType: 'message',
        resourceId: 'reply-id',
        channelId: 'channel',
        type: 'thread_reply',
    } as AppNotification;
    expect(resolveNotificationHref('team', notification)).toBe('/team/channel/channel?message=reply-id');
});
