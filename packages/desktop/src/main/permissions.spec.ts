import { EventEmitter } from 'node:events';
import { shell } from 'electron';
import { configurePermissions, protectNavigation } from './permissions';

vi.mock('electron', () => ({
    shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}));

function harness() {
    let display!: (...args: any[]) => Promise<void>;
    let permission!: (...args: any[]) => void;
    const getSources = vi.fn().mockResolvedValue([
        { id: 'screen:1:0', name: 'Display' },
        { id: 'window:1:0', name: 'Editor' },
    ]);
    const picker = vi.fn().mockImplementation(async (sources) => sources[1]);
    const session = {
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn((handler) => {
            permission = handler;
        }),
        setDisplayMediaRequestHandler: vi.fn((handler) => {
            display = handler;
        }),
    };
    configurePermissions(session as any, { getSources }, picker);
    const request = {
        securityOrigin: 'https://slacord.cloud',
        videoRequested: true,
    };
    return { session, getSources, picker, display, permission, request };
}

describe('desktop permissions', () => {
    it('allows sanitized clipboard writes for trusted domains, never clipboard reads or untrusted writes', () => {
        const h = harness();
        const check = h.session.setPermissionCheckHandler.mock.calls[0][0] as (...args: any[]) => boolean;
        const callback = vi.fn();
        for (const origin of ['https://gadoc.kr', 'https://slacord.cloud']) {
            expect(check({}, 'clipboard-sanitized-write', origin)).toBe(true);
            h.permission({}, 'clipboard-sanitized-write', callback, { requestingUrl: origin + '/team' });
            expect(callback).toHaveBeenLastCalledWith(true);
            for (const permission of ['clipboard-read', 'deprecated-sync-clipboard-read']) {
                expect(check({}, permission, origin)).toBe(false);
                h.permission({}, permission, callback, { requestingUrl: origin + '/team' });
                expect(callback).toHaveBeenLastCalledWith(false);
            }
        }
        expect(check({}, 'clipboard-sanitized-write', 'https://gadoc.kr.evil.example')).toBe(false);
        h.permission({}, 'clipboard-sanitized-write', callback, { requestingUrl: 'https://evil.example' });
        expect(callback).toHaveBeenLastCalledWith(false);
    });
    it('returns only the source explicitly selected by the user', async () => {
        const h = harness();
        const callback = vi.fn();
        await h.display(h.request, callback);
        expect(callback).toHaveBeenCalledWith({
            video: { id: 'window:1:0', name: 'Editor' },
        });
        expect(h.session.setDisplayMediaRequestHandler).toHaveBeenCalledWith(expect.any(Function), {
            useSystemPicker: true,
        });
    });
    it('rejects canceled source selection instead of sharing the first screen', async () => {
        const h = harness();
        const callback = vi.fn();
        h.picker.mockResolvedValue(null);
        await h.display(h.request, callback);
        expect(callback).toHaveBeenCalledWith({});
    });
    it('resolves capture permission errors without leaving the request pending', async () => {
        const h = harness();
        const callback = vi.fn();
        h.getSources.mockRejectedValue(new Error('Denied'));
        await h.display(h.request, callback);
        expect(callback).toHaveBeenCalledExactlyOnceWith({});
    });
    it('never enumerates displays for an untrusted origin', async () => {
        const h = harness();
        const callback = vi.fn();
        await h.display({ ...h.request, securityOrigin: 'https://evil.example' }, callback);
        expect(callback).toHaveBeenCalledWith({});
        expect(h.getSources).not.toHaveBeenCalled();
    });
    it('allows media and notifications only for the app origin', () => {
        const h = harness();
        const callback = vi.fn();
        h.permission({}, 'display-capture', callback, {
            requestingUrl: 'https://slacord.cloud/team',
        });
        expect(callback).toHaveBeenLastCalledWith(true);
        h.permission({}, 'media', callback, {
            requestingUrl: 'https://evil.example',
        });
        expect(callback).toHaveBeenLastCalledWith(false);
    });
});

describe('attachment navigation', () => {
    function navigation() {
        let open!: (input: { url: string }) => unknown;
        const contents = Object.assign(new EventEmitter(), {
            setWindowOpenHandler: vi.fn((handler) => {
                open = handler;
            }),
            downloadURL: vi.fn(),
            loadURL: vi.fn().mockResolvedValue(undefined),
        });
        protectNavigation(contents as any);
        return { contents, open: (url: string) => open({ url }) };
    }
    it('downloads protected file links without replacing the app renderer', () => {
        const { contents, open } = navigation();
        const url = 'https://slacord.cloud/api/files?key=gadoc%2Fchat%2Fphoto.png';
        expect(open(url)).toEqual({ action: 'deny' });
        expect(contents.downloadURL).toHaveBeenCalledExactlyOnceWith(url);
        expect(contents.loadURL).not.toHaveBeenCalled();
    });
    it.each(['will-navigate', 'will-redirect'])('keeps the app open for %s file requests', (eventName) => {
        const { contents } = navigation();
        const event = { preventDefault: vi.fn() };
        const url = 'https://slacord.cloud/api/files?key=photo.png';
        contents.emit(eventName, event, url);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(contents.downloadURL).toHaveBeenCalledWith(url);
        expect(contents.loadURL).not.toHaveBeenCalled();
    });
    it('retains trusted internal navigation but never downloads an untrusted file URL with the app session', () => {
        const { contents, open } = navigation();
        open('https://slacord.cloud/dashboard');
        expect(contents.loadURL).toHaveBeenCalledWith('https://slacord.cloud/dashboard');
        open('https://untrusted.example/api/files?key=photo.png');
        expect(contents.downloadURL).not.toHaveBeenCalled();
        expect(shell.openExternal).toHaveBeenCalledWith('https://untrusted.example/api/files?key=photo.png');
    });
});
