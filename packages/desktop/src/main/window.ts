import { app, BrowserWindow, screen } from 'electron';
import { getPreloadPath, getStartUrl } from './config';
import { protectNavigation } from './permissions';
import { offlinePage } from './offline';

let isQuitting = false;
app.on('before-quit', () => {
    isQuitting = true;
});

export function createMainWindow() {
    // Electron's work area and window bounds are already in DIP (including DPI scaling).
    const { workArea } = screen.getPrimaryDisplay();
    const window = new BrowserWindow({
        width: Math.min(1440, workArea.width),
        height: Math.min(960, workArea.height),
        // Allow half-screen Snap on scaled laptop displays and the compact web layout.
        minWidth: Math.min(400, workArea.width),
        minHeight: Math.min(320, workArea.height),
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

    const fitToDisplay = () => {
        if (window.isDestroyed() || window.isMinimized() || window.isMaximized() || window.isFullScreen()) return;
        // Windows owns snapped geometry, including invisible native frame margins.
        if (process.platform === 'win32' && window.isSnapped()) return;
        const bounds = window.getBounds();
        const area = screen.getDisplayMatching(bounds).workArea;
        const width = Math.min(bounds.width, area.width);
        const height = Math.min(bounds.height, area.height);
        const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - width));
        const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - height));
        window.setMinimumSize(Math.min(400, area.width), Math.min(320, area.height));
        // Leave valid narrow/Snapped bounds alone; recover only off-screen geometry.
        if (x !== bounds.x || y !== bounds.y || width !== bounds.width || height !== bounds.height) {
            window.setBounds({ x, y, width, height });
        }
    };
    window.on('show', fitToDisplay);
    window.on('restore', fitToDisplay);
    screen.on('display-removed', fitToDisplay);
    screen.on('display-metrics-changed', fitToDisplay);
    window.once('closed', () => {
        screen.removeListener('display-removed', fitToDisplay);
        screen.removeListener('display-metrics-changed', fitToDisplay);
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
