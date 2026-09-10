import { configurePermissions } from './permissions';

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
