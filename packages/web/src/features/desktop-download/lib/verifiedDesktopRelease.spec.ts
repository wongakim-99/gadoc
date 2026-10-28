import { describe, expect, it } from 'vitest';
import { parseDesktopVerification, verifiedDesktopRelease } from './verifiedDesktopRelease';

describe('설치 파일의 서명·공증 근거', () => {
    const proof = {
        schemaVersion: 1,
        version: verifiedDesktopRelease.version,
        mac: { codeSigned: true, notarized: true },
        windows: { codeSigned: false },
        assets: verifiedDesktopRelease.assets.map(({ name, sha256 }) => ({ name, sha256 })),
    };
    it('설치 파일 해시가 전부 일치할 때만 검증 상태를 표시함', () => {
        expect(parseDesktopVerification(proof, verifiedDesktopRelease)).toEqual({
            macos: 'notarized',
            windows: 'unsigned',
        });
    });
    it.each([
        null,
        {},
        { ...proof, version: '0.0.1' },
        { ...proof, assets: [] },
        { ...proof, assets: proof.assets.map((asset) => ({ ...asset, sha256: '0'.repeat(64) })) },
    ])('버전 또는 해시 불일치 근거를 거절함', (value) => {
        expect(parseDesktopVerification(value, verifiedDesktopRelease)).toBeNull();
    });
    it('서명만으로 공증 완료를 주장하지 않음', () => {
        expect(
            parseDesktopVerification({ ...proof, mac: { codeSigned: true, notarized: false } }, verifiedDesktopRelease)
                ?.macos,
        ).toBe('unknown');
    });
});
