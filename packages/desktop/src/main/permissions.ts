import {
    desktopCapturer,
    Menu,
    shell,
    session,
    systemPreferences,
    type DesktopCapturerSource,
    type WebContents,
} from 'electron';
import { isAllowedUrl, isExternalUrl } from './config';

interface PermissionSession {
    setDisplayMediaRequestHandler: typeof session.defaultSession.setDisplayMediaRequestHandler;
    setPermissionCheckHandler: typeof session.defaultSession.setPermissionCheckHandler;
    setPermissionRequestHandler: typeof session.defaultSession.setPermissionRequestHandler;
}
interface DisplaySourceCapturer {
    getSources: typeof desktopCapturer.getSources;
}
type SourcePicker = (sources: DesktopCapturerSource[]) => Promise<DesktopCapturerSource | null>;

/** Windows/fallback picker: sharing always requires an explicit source choice. */
export const chooseDisplaySource: SourcePicker = async (sources) => {
    if (!sources.length) return null;
    return new Promise((resolve) => {
        let selected: DesktopCapturerSource | null = null;
        const menu = Menu.buildFromTemplate([
            { label: '공유할 화면 또는 창 선택', enabled: false },
            { type: 'separator' },
            ...sources.map((source) => ({
                label: `${source.id.startsWith('screen:') ? '화면' : '창'}: ${source.name}`,
                click: () => {
                    selected = source;
                },
            })),
            { type: 'separator' },
            {
                label: '취소',
                click: () => {
                    selected = null;
                },
            },
        ]);
        menu.popup({ callback: () => resolve(selected) });
    });
};

export function configurePermissions(
    targetSession: PermissionSession = session.defaultSession,
    capturer: DisplaySourceCapturer = desktopCapturer,
    pickSource: SourcePicker = chooseDisplaySource,
) {
    targetSession.setPermissionCheckHandler(
        (_wc, permission, origin) =>
            isAllowedUrl(origin) && ['notifications', 'media', 'display-capture'].includes(permission),
    );
    targetSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
        callback(
            isAllowedUrl(details.requestingUrl) && ['notifications', 'media', 'display-capture'].includes(permission),
        );
    });
    targetSession.setDisplayMediaRequestHandler(
        async (request, callback) => {
            if (!isAllowedUrl(request.securityOrigin) || !request.videoRequested) {
                callback({});
                return;
            }
            try {
                const source = await pickSource(await capturer.getSources({ types: ['screen', 'window'] }));
                callback(source ? { video: { id: source.id, name: source.name } } : {});
            } catch {
                // Permission denial/capture errors must resolve the request, not
                // leave getDisplayMedia pending indefinitely.
                callback({});
            }
        },
        { useSystemPicker: true },
    );
}

/** Request only the device being enabled; old clients can still request both. */
export async function requestMediaAccess(
    kind?: 'microphone' | 'camera',
): Promise<{ microphone: boolean; camera: boolean }> {
    if (process.platform !== 'darwin') return { microphone: true, camera: true };
    const microphone =
        kind === 'camera'
            ? systemPreferences.getMediaAccessStatus('microphone') === 'granted'
            : await systemPreferences.askForMediaAccess('microphone');
    const camera =
        kind === 'microphone'
            ? systemPreferences.getMediaAccessStatus('camera') === 'granted'
            : await systemPreferences.askForMediaAccess('camera');
    return { microphone, camera };
}

export function protectNavigation(contents: WebContents) {
    const openExternal = (url: string) => {
        if (isExternalUrl(url)) void shell.openExternal(url).catch(() => undefined);
    };
    contents.setWindowOpenHandler(({ url }) => {
        // Keep a single trusted renderer. New internal links reuse it.
        if (isAllowedUrl(url)) void contents.loadURL(url).catch(() => undefined);
        else openExternal(url);
        return { action: 'deny' };
    });
    const guard = (event: Electron.Event, url: string) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            openExternal(url);
        }
    };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('will-attach-webview', (event) => event.preventDefault());
}
