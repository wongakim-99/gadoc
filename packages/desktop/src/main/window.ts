import { app, BrowserWindow } from 'electron';
import { getPreloadPath, getStartUrl } from './config';
import { protectNavigation } from './permissions';
import { offlinePage } from './offline';

let isQuitting = false;
app.on('before-quit', () => {
    isQuitting = true;
});

export function createMainWindow() {
    const window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1180,
        minHeight: 760,
        backgroundColor: '#191c21',
        title: 'GaDoc',
        // Native chrome reserves space for the window controls on every route.
        titleBarStyle: 'default',
        show: false,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: true,
            backgroundThrottling: false,
        },
    });

    protectNavigation(window.webContents);
    window.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
        if (!isMainFrame || code === -3 || url.startsWith('data:')) return;
        void window.loadURL(offlinePage(getStartUrl())).catch(() => undefined);
        window.show();
    });
    window.once('ready-to-show', () => window.show());

    // Windows/macOS: close hides the window, preserving sockets and calls.
    // Tray Quit or Cmd+Q is the explicit exit path.
    window.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            window.hide();
        }
    });

    window.on('focus', () => window.flashFrame(false));
    void window.loadURL(getStartUrl()).catch(() => undefined);
    return window;
}
