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
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { deliver: true } }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { deliver: false } }) }),
        );
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ id: 'message:1', teamId: 'team', title: 'Channel', body: 'Hello' });
        await show({ id: 'message:1', teamId: 'team', title: 'Mention', body: 'Hello' });
        expect(notify).toHaveBeenCalledTimes(1);
    });
    it('contains native bridge failures so the socket handler can continue', async () => {
        vi.stubGlobal('window', {
            slacordDesktop: { isDesktop: true, notify: vi.fn().mockRejectedValue(new Error('OS denied')) },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { deliver: true } }) }),
        );
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await expect(
            show({ id: 'message:1', teamId: 'team', title: 'New message', body: 'Hello' }),
        ).resolves.toBeUndefined();
    });
    it('does not prompt for browser notification permission from an incoming event', async () => {
        const requestPermission = vi.fn();
        const notifications = { permission: 'default', requestPermission };
        vi.stubGlobal('window', { Notification: notifications });
        vi.stubGlobal('Notification', notifications);
        vi.stubGlobal('document', { visibilityState: 'hidden', hasFocus: () => false });
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ id: 'message:1', teamId: 'team', title: 'New message', body: 'Hello' });
        expect(requestPermission).not.toHaveBeenCalled();
    });

    it.each(['native', 'browser'])('honors server mute in the %s delivery path even when forced', async (path) => {
        const notify = vi.fn();
        const BrowserNotification = vi.fn();
        Object.assign(BrowserNotification, { permission: 'granted' });
        vi.stubGlobal('Notification', BrowserNotification);
        vi.stubGlobal(
            'window',
            path === 'native' ? { slacordDesktop: { isDesktop: true, notify } } : { Notification: BrowserNotification },
        );
        vi.stubGlobal('document', { visibilityState: 'hidden', hasFocus: () => false });
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { deliver: false } }) });
        vi.stubGlobal('fetch', fetcher);
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ id: 'message:1', teamId: 'team', title: 'Muted', body: 'Private', force: true });
        expect(fetcher).toHaveBeenCalledWith(
            '/api/team/team/notification/delivery-claim',
            expect.objectContaining({ body: JSON.stringify({ key: 'message:1' }), credentials: 'include' }),
        );
        expect(notify).not.toHaveBeenCalled();
        expect(BrowserNotification).not.toHaveBeenCalled();
    });

    it('fails closed on missing scope and failed policy requests without poisoning later attempts', async () => {
        const notify = vi.fn();
        vi.stubGlobal('window', { slacordDesktop: { isDesktop: true, notify } });
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { deliver: true } }) });
        vi.stubGlobal('fetch', fetcher);
        const { showDesktopMessageNotification: show } = await import('./desktop-notifications');
        await show({ id: 'message:1', title: 'No workspace', body: '' });
        await show({ teamId: 'team', title: 'No identity', body: '' });
        expect(fetcher).not.toHaveBeenCalled();
        const input = { id: 'message:1', teamId: 'team', title: 'Scoped', body: '' };
        await show(input);
        await show(input);
        expect(notify).not.toHaveBeenCalled();
        await show(input);
        expect(notify).toHaveBeenCalledOnce();
    });
});
