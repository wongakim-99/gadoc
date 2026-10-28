import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDesktopRelease } from './getDesktopRelease';
import { verifiedDesktopRelease } from '../lib/verifiedDesktopRelease';

afterEach(() => vi.unstubAllGlobals());

describe('desktop release availability', () => {
    it.each([404, 403, 500])('handles GitHub HTTP %s without breaking the page', async (status) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
        const release = await getDesktopRelease();
        expect(release.source).toBe('verified-fallback');
        expect(release.assets).toHaveLength(3);
        expect(release.assets.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256 ?? ''))).toBe(true);
    });
    it('handles network failures and timeouts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
        expect((await getDesktopRelease()).source).toBe('verified-fallback');
    });
    it('handles malformed responses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')));
        expect((await getDesktopRelease()).assets).toHaveLength(3);
    });
    it('조회 성공 시 공개 버전을 사용하고 근거 없는 서명 표시는 하지 않음', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        tag_name: 'v2.0.0',
                        draft: false,
                        prerelease: false,
                        assets: [
                            {
                                name: 'GaDoc-2.0.0-arm64.dmg',
                                state: 'uploaded',
                                size: 100,
                                browser_download_url:
                                    'https://github.com/kscold/gadoc/releases/download/v2.0.0/GaDoc-2.0.0-arm64.dmg',
                            },
                        ],
                    }),
                ),
            ),
        );
        const release = await getDesktopRelease();
        expect(release.version).toBe('2.0.0');
        expect(release.source).toBe('github');
        expect(release.verification.macos).toBe('unknown');
    });

    function withProof() {
        return {
            tag_name: 'v1.1.1',
            draft: false,
            prerelease: false,
            assets: [
                ...verifiedDesktopRelease.assets.map((asset) => ({
                    name: asset.name,
                    browser_download_url: asset.href,
                    size: asset.bytes,
                    digest: `sha256:${asset.sha256}`,
                    state: 'uploaded',
                })),
                {
                    name: 'desktop-verification.json',
                    browser_download_url:
                        'https://github.com/kscold/gadoc/releases/download/v1.1.1/desktop-verification.json',
                    size: 1000,
                    state: 'uploaded',
                },
            ],
        };
    }

    it('공개 릴리즈의 해시와 공증 근거를 함께 확인함', async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(withProof())))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        schemaVersion: 1,
                        version: '1.1.1',
                        mac: { codeSigned: true, notarized: true },
                        windows: { codeSigned: false },
                        assets: verifiedDesktopRelease.assets.map(({ name, sha256 }) => ({ name, sha256 })),
                    }),
                ),
            );
        vi.stubGlobal('fetch', fetch);
        const release = await getDesktopRelease();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(release.verification).toEqual({ macos: 'notarized', windows: 'unsigned' });
    });

    it('검증 근거 조회가 실패해도 이미 확인한 설치 파일을 숨기지 않음', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(new Response(JSON.stringify(withProof())))
                .mockRejectedValueOnce(new Error('timeout')),
        );
        const release = await getDesktopRelease();
        expect(release.source).toBe('github');
        expect(release.assets).toHaveLength(3);
        expect(release.verification.macos).toBe('unsigned');
    });

    it('장애 시 반환한 객체 변경이 다음 요청의 스냅샷을 오염시키지 않음', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const first = await getDesktopRelease();
        first.assets.length = 0;
        first.verification.macos = 'notarized';
        const next = await getDesktopRelease();
        expect(next.assets).toHaveLength(3);
        expect(next.verification.macos).toBe('unsigned');
    });
});
