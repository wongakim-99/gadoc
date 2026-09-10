import { app, BrowserWindow, Notification, ipcMain, nativeImage, type WebContents } from 'electron';
import { getAppOrigin, getNotificationIcon, resolveAppPath } from './config';
import { isTrustedSender } from './ipc-security';

const navigationReady = new WeakSet<WebContents>();
const activeNotifications = new Set<Notification>();

export function registerNotificationIpc() {
    ipcMain.handle('desktop:navigation-ready', (event) => {
        if (!isTrustedSender(event)) return null;
        navigationReady.add(event.sender);
        return null;
    });
    ipcMain.handle('desktop:set-badge-count', (event, value: unknown) => {
        if (!isTrustedSender(event) || typeof value !== 'number' || !Number.isFinite(value)) return false;
        const count = Math.max(0, Math.min(9999, Math.floor(value)));
        const win = BrowserWindow.fromWebContents(event.sender);
        if (process.platform === 'win32' && win) {
            win.setOverlayIcon(
                count ? nativeImage.createFromPath(getNotificationIcon()) : null,
                count ? `읽지 않은 알림 ${count}개` : '',
            );
            if (!count) win.flashFrame(false);
        } else {
            app.setBadgeCount(count);
        }
        return true;
    });
    ipcMain.handle('desktop:notify', (event, payload: unknown) => {
        if (!isTrustedSender(event) || typeof payload !== 'object' || payload === null) return false;
        const { title, body, href } = payload as Record<string, unknown>;
        if (typeof title !== 'string' || typeof body !== 'string' || !Notification.isSupported()) return false;
        const owner = BrowserWindow.fromWebContents(event.sender);
        if (!owner) return false;
        const route = resolveAppPath(href);
        try {
            const notification = new Notification({
                title: title.slice(0, 200),
                body: body.slice(0, 500),
                icon: getNotificationIcon(),
                silent: false,
            });
            activeNotifications.add(notification);
            // Bound retained OS objects even on platforms which omit close events.
            if (activeNotifications.size > 50) {
                const oldest = activeNotifications.values().next().value;
                oldest?.close();
                if (oldest) activeNotifications.delete(oldest);
            }
            notification.once('click', () => {
                if (owner.isDestroyed()) return;
                if (owner.isMinimized()) owner.restore();
                owner.show();
                owner.focus();
                owner.flashFrame(false);
                if (route) {
                    // New web clients navigate through Next's router without
                    // reloading the renderer. Older clients retain the fallback.
                    if (navigationReady.has(event.sender) && !event.sender.isLoadingMainFrame()) {
                        event.sender.send('desktop:navigate', route);
                    } else {
                        void owner.loadURL(new URL(route, getAppOrigin()).toString()).catch(() => undefined);
                    }
                }
            });
            const release = () => {
                activeNotifications.delete(notification);
                notification.removeAllListeners();
            };
            notification.once('close', release);
            notification.once('failed', release);
            notification.show();
            if (!owner.isFocused()) {
                if (process.platform === 'darwin') app.dock?.bounce('informational');
                if (process.platform === 'win32') owner.flashFrame(true);
            }
            return true;
        } catch {
            return false;
        }
    });
}
