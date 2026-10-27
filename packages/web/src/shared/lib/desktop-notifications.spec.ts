import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe('desktop notification delivery', () => {
    it('claims across independent renderers and suppresses the losing client', async () => {
        const notify = vi.fn().mockResolvedValue(true);
        vi.stubGlobal('window', { slacordDesktop: { isDesktop: true, notify } });
        const fetcher = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { deliver: true } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { deliver: false } }) });
        vi.stubGlobal('fetch', fetcher);
        const first = await import('./desktop-notifications');
        await first.showDesktopMessageNotification({
            id: 'message:123',
            teamId: 'team',
            title: 'Test',
            body: 'Message',
        });
        vi.resetModules();
        const second = await import('./desktop-notifications');
        await second.showDesktopMessageNotification({
            id: 'message:123',
            teamId: 'team',
            title: 'Test',
            body: 'Message',
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenCalledTimes(1);
    });
    it('deduplicates message and mention delivery for the same message', async () => {
        const notify = vi.fn().mockResolvedValue(true);
        vi.stubGlobal('window', { slacordDesktop: { isDesktop: true, notify } });
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ id: 'message:1', title: 'Channel', body: 'Hello' });
        await show({ id: 'message:1', title: 'Mention', body: 'Hello' });
        expect(notify).toHaveBeenCalledTimes(1);
    });
    it('contains native bridge failures so the socket handler can continue', async () => {
        vi.stubGlobal('window', {
            slacordDesktop: { isDesktop: true, notify: vi.fn().mockRejectedValue(new Error('OS denied')) },
        });
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await expect(show({ title: 'New message', body: 'Hello' })).resolves.toBeUndefined();
    });
    it('does not prompt for browser notification permission from an incoming event', async () => {
        const requestPermission = vi.fn();
        const notifications = { permission: 'default', requestPermission };
        vi.stubGlobal('window', { Notification: notifications });
        vi.stubGlobal('Notification', notifications);
        vi.stubGlobal('document', { visibilityState: 'hidden', hasFocus: () => false });
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ title: 'New message', body: 'Hello' });
        expect(requestPermission).not.toHaveBeenCalled();
    });
});
