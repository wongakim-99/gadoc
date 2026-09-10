import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDesktopRelease } from './getDesktopRelease';

afterEach(() => vi.unstubAllGlobals());

describe('desktop release availability', () => {
    it.each([404, 403, 500])('handles GitHub HTTP %s without breaking the page', async (status) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
        expect(await getDesktopRelease()).toBeNull();
    });
    it('handles network failures and timeouts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
        expect(await getDesktopRelease()).toBeNull();
    });
    it('handles malformed responses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')));
        expect(await getDesktopRelease()).toBeNull();
    });
});
