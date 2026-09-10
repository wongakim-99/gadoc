import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import { getNotificationIcon } from './config';

let tray: Tray | null = null;

export function setupTray(getWindow: () => BrowserWindow | null) {
    if (tray) return;
    const show = () => {
        const window = getWindow();
        if (!window || window.isDestroyed()) return;
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
    };
    tray = new Tray(nativeImage.createFromPath(getNotificationIcon()).resize({ width: 18, height: 18 }));
    tray.setToolTip('Slacord — 백그라운드에서 알림 수신 중');
    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: 'Slacord 열기', click: show },
            { type: 'separator' },
            { label: '종료', click: () => app.quit() },
        ]),
    );
    tray.on('click', show);
    app.once('will-quit', () => {
        tray?.destroy();
        tray = null;
    });
}
