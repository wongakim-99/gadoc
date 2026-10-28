import { EventEmitter } from 'node:events';

async function harness(platform = 'darwin') {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: platform });
    const frame = { url: 'https://slacord.cloud/workspace' };
    const sender = {
        mainFrame: frame,
        send: vi.fn(),
        isLoadingMainFrame: () => false,
    };
    const event = { senderFrame: frame, sender };
    const win = {
        isDestroyed: () => false,
        isMinimized: () => true,
        isFocused: () => false,
        restore: vi.fn(),
        show: vi.fn(),
        focus: vi.fn(),
        flashFrame: vi.fn(),
        setOverlayIcon: vi.fn(),
        loadURL: vi.fn().mockResolvedValue(undefined),
    };
    const handlers = new Map<string, (...args: any[]) => any>();
    const notifications: Array<EventEmitter & { show: any; close: any }> = [];
    const app = {
        isPackaged: false,
        getAppPath: () => '.',
        setBadgeCount: vi.fn(),
        dock: { bounce: vi.fn() },
    };
    vi.doMock('electron', () => ({
        app,
        BrowserWindow: { fromWebContents: () => win },
        nativeImage: { createFromPath: () => 'icon' },
        ipcMain: {
            handle: (name: string, callback: any) => handlers.set(name, callback),
        },
        Notification: class extends EventEmitter {
            static isSupported() {
                return true;
            }
            show = vi.fn();
            close = vi.fn();
            constructor(public options: any) {
                super();
                notifications.push(this);
            }
        },
    }));
    const { registerNotificationIpc } = await import('./notifications');
    registerNotificationIpc();
    return {
        event,
        sender,
        win,
        app,
        notifications,
        invoke: (channel: string, ...args: any[]) => handlers.get(channel)!(event, ...args),
        handlers,
    };
}
const platform = process.platform;
afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
    vi.unstubAllGlobals();
});

describe('native notifications', () => {
    it('restores the owning window and routes without reloading the web app', async () => {
        const h = await harness();
        h.invoke('desktop:navigation-ready');
        expect(
            h.invoke('desktop:notify', {
                title: 'Mention',
                body: 'Hello',
                href: '/team/channel/chat',
            }),
        ).toBe(true);
        h.notifications[0].emit('click');
        expect(h.win.restore).toHaveBeenCalled();
        expect(h.win.focus).toHaveBeenCalled();
        expect(h.sender.send).toHaveBeenCalledWith('desktop:navigate', '/team/channel/chat');
        expect(h.win.loadURL).not.toHaveBeenCalled();
    });
    it('supports older web clients with same-origin navigation fallback', async () => {
        const h = await harness();
        h.invoke('desktop:notify', {
            title: 'Issue',
            body: 'Assigned',
            href: '/team/issues',
        });
        h.notifications[0].emit('click');
        expect(h.win.loadURL).toHaveBeenCalledWith('https://gadoc.kr/team/issues');
    });
    it('never opens protocol-relative notification links', async () => {
        const h = await harness();
        h.invoke('desktop:notify', {
            title: 'X',
            body: 'Y',
            href: '//evil.example/path',
        });
        h.notifications[0].emit('click');
        expect(h.win.loadURL).not.toHaveBeenCalled();
        expect(h.sender.send).not.toHaveBeenCalled();
    });
    it('rejects IPC from child frames and external documents', async () => {
        const h = await harness();
        expect(
            h.handlers.get('desktop:notify')!(
                { ...h.event, senderFrame: { url: 'https://evil.example' } },
                { title: 'X', body: 'Y' },
            ),
        ).toBe(false);
        expect(h.notifications).toHaveLength(0);
    });
    it('updates and clears the Windows unread overlay', async () => {
        const h = await harness('win32');
        h.invoke('desktop:set-badge-count', 4);
        expect(h.win.setOverlayIcon).toHaveBeenLastCalledWith('icon', '읽지 않은 알림 4개');
        h.invoke('desktop:set-badge-count', 0);
        expect(h.win.setOverlayIcon).toHaveBeenLastCalledWith(null, '');
        expect(h.invoke('desktop:set-badge-count', Infinity)).toBe(false);
    });
    it('updates the macOS Dock badge and cleans dismissed notification listeners', async () => {
        const h = await harness();
        h.invoke('desktop:set-badge-count', 2);
        expect(h.app.setBadgeCount).toHaveBeenCalledWith(2);
        h.invoke('desktop:notify', { title: 'X', body: 'Y' });
        h.notifications[0].emit('close');
        expect(h.notifications[0].listenerCount('click')).toBe(0);
    });
});
