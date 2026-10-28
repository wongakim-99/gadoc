import { EventEmitter } from 'node:events';

const originalPlatform = process.platform;
afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
});

async function harness(platform: string, workArea = { x: 0, y: 0, width: 1920, height: 1040 }) {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: platform });
    const app = new EventEmitter();
    const display = { workArea, scaleFactor: 1.5 };
    const screen = Object.assign(new EventEmitter(), {
        getPrimaryDisplay: vi.fn(() => display),
        getDisplayMatching: vi.fn(() => display),
    });
    class Window extends EventEmitter {
        webContents = Object.assign(new EventEmitter(), {
            setWindowOpenHandler: vi.fn(),
            loadURL: vi.fn().mockResolvedValue(undefined),
        });
        show = vi.fn();
        hide = vi.fn();
        flashFrame = vi.fn();
        loadURL = vi.fn().mockResolvedValue(undefined);
        isDestroyed = vi.fn(() => false);
        isMinimized = vi.fn(() => false);
        isMaximized = vi.fn(() => false);
        isFullScreen = vi.fn(() => false);
        isSnapped = vi.fn(() => false);
        getBounds = vi.fn(() => ({ x: 100, y: 50, width: 1440, height: 960 }));
        setBounds = vi.fn();
        setMinimumSize = vi.fn();
        constructor(public options: any) {
            super();
        }
    }
    vi.doMock('electron', () => ({
        app,
        screen,
        BrowserWindow: Window,
        shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
    }));
    const { createMainWindow } = await import('./window');
    return { app, screen, display, window: createMainWindow() as unknown as Window };
}

describe.each(['win32', 'darwin'])('desktop window on %s', (platform) => {
    it.each([
        [1920, 1040], [1280, 680], [960, 500], [853, 440],
    ])('allows half-screen width and fits startup in %ix%i DIP', async (width, height) => {
        const { window } = await harness(platform, { x: 0, y: 0, width, height });
        expect(window.options.minWidth).toBeLessThanOrEqual(Math.floor(width / 2));
        expect(window.options.minHeight).toBeLessThanOrEqual(height);
        expect(window.options.width).toBe(Math.min(1440, width));
        expect(window.options.height).toBe(Math.min(960, height));
    });

    it.each(['show', 'restore', 'display-removed', 'display-metrics-changed'])(
        'recovers off-screen bounds on %s after undocking or scaling changes', async (event) => {
            const { window, screen } = await harness(platform, { x: -1280, y: 40, width: 1280, height: 680 });
            window.getBounds.mockReturnValue({ x: 1920, y: 0, width: 1440, height: 960 });
            (event.startsWith('display-') ? screen : window).emit(event);
            expect(window.setBounds).toHaveBeenCalledWith({ x: -1280, y: 40, width: 1280, height: 680 });
            expect(window.setMinimumSize).toHaveBeenCalledWith(400, 320);
        },
    );

    it('preserves narrow snapped bounds when showing or changing display metrics', async () => {
        const { window, screen } = await harness(platform, { x: 0, y: 0, width: 960, height: 500 });
        window.getBounds.mockReturnValue({ x: 480, y: 0, width: 480, height: 500 });
        window.emit('show');
        screen.emit('display-metrics-changed');
        expect(window.setBounds).not.toHaveBeenCalled();
    });

    it('preserves Windows Snap native frame margins', async () => {
        const { window, screen } = await harness('win32', { x: 0, y: 0, width: 960, height: 500 });
        window.isSnapped.mockReturnValue(true);
        window.getBounds.mockReturnValue({ x: -7, y: 0, width: 494, height: 507 });
        window.emit('show');
        screen.emit('display-metrics-changed');
        expect(window.setBounds).not.toHaveBeenCalled();
    });

    it.each(['isMinimized', 'isMaximized', 'isFullScreen', 'isDestroyed'] as const)(
        'leaves native window state alone when %s', async (state) => {
            const { window, screen } = await harness(platform);
            window[state].mockReturnValue(true);
            screen.emit('display-metrics-changed');
            expect(window.setBounds).not.toHaveBeenCalled();
        },
    );

    it('removes screen listeners when the window is destroyed', async () => {
        const { window, screen } = await harness(platform);
        window.emit('closed');
        expect(screen.listenerCount('display-removed')).toBe(0);
        expect(screen.listenerCount('display-metrics-changed')).toBe(0);
    });
    it('keeps the renderer alive on close, but allows explicit quit', async () => {
        const { app, window } = await harness(platform);
        const preventDefault = vi.fn();
        window.emit('close', { preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(window.hide).toHaveBeenCalled();
        preventDefault.mockClear();
        app.emit('before-quit');
        window.emit('close', { preventDefault });
        expect(preventDefault).not.toHaveBeenCalled();
        expect(window.options.titleBarStyle).toBe('default');
        expect(window.options.title).toBe('GaDoc');
        expect(window.options.webPreferences).toMatchObject({
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        });
    });
    it('shows a retry surface when the remote web app is unreachable', async () => {
        const { window } = await harness(platform);
        window.webContents.emit('did-fail-load', {}, -106, 'Offline', 'https://slacord.cloud', true);
        expect(window.loadURL).toHaveBeenLastCalledWith(expect.stringContaining('data:text/html'));
        expect(window.show).toHaveBeenCalled();
    });
});
