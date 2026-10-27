import { EventEmitter } from 'node:events';

const originalPlatform = process.platform;
afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
});

async function harness(platform: string) {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: platform });
    const app = new EventEmitter();
    class Window extends EventEmitter {
        webContents = Object.assign(new EventEmitter(), {
            setWindowOpenHandler: vi.fn(),
            loadURL: vi.fn().mockResolvedValue(undefined),
        });
        show = vi.fn();
        hide = vi.fn();
        flashFrame = vi.fn();
        loadURL = vi.fn().mockResolvedValue(undefined);
        constructor(public options: any) {
            super();
        }
    }
    vi.doMock('electron', () => ({
        app,
        BrowserWindow: Window,
        shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
    }));
    const { createMainWindow } = await import('./window');
    return { app, window: createMainWindow() as unknown as Window };
}

describe.each(['win32', 'darwin'])('desktop window on %s', (platform) => {
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
