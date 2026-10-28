import type { DesktopRelease } from './parseDesktopRelease';

export interface DesktopReleaseDetails extends DesktopRelease {
    source: 'github' | 'verified-fallback';
    verification: { macos: 'notarized' | 'unsigned' | 'unknown'; windows: 'signed' | 'unsigned' | 'unknown' };
}

// 실제 공개 릴리즈의 파일·크기·해시를 확인한 스냅샷이다. 미발행 버전은 넣지 않는다.
export const verifiedDesktopRelease: DesktopReleaseDetails = {
    version: '1.1.1',
    source: 'verified-fallback',
    verification: { macos: 'unsigned', windows: 'unsigned' },
    assets: [
        {
            name: 'GaDoc-1.1.1-arm64.dmg',
            href: 'https://github.com/kscold/gadoc/releases/download/v1.1.1/GaDoc-1.1.1-arm64.dmg',
            bytes: 120918028,
            sha256: '44fdb4979cf56c893aeec9b6ae565c2dcfda55cd3e6da198c8fbe347a318fd94',
        },
        {
            name: 'GaDoc-1.1.1-arm64.zip',
            href: 'https://github.com/kscold/gadoc/releases/download/v1.1.1/GaDoc-1.1.1-arm64.zip',
            bytes: 117409544,
            sha256: 'bb94d2c9da5dce2b679ac0fff6b8325c461486d41a94bdb236c2057c5b186e2d',
        },
        {
            name: 'GaDoc-1.1.1-x64.exe',
            href: 'https://github.com/kscold/gadoc/releases/download/v1.1.1/GaDoc-1.1.1-x64.exe',
            bytes: 121633877,
            sha256: '7278fc679afa7f8137c58e98f0188549771ccfbec78ffec8b908ac922b0cb6b8',
        },
    ],
};

export function snapshotVerification(release: DesktopRelease): DesktopReleaseDetails['verification'] {
    return release.version === verifiedDesktopRelease.version &&
        release.assets.every((asset) =>
            verifiedDesktopRelease.assets.some((known) => known.name === asset.name && known.sha256 === asset.sha256),
        )
        ? { ...verifiedDesktopRelease.verification }
        : { macos: 'unknown', windows: 'unknown' };
}

export function parseDesktopVerification(
    value: unknown,
    release: DesktopRelease,
): DesktopReleaseDetails['verification'] | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    if (data.schemaVersion !== 1 || data.version !== release.version || !Array.isArray(data.assets)) return null;
    const assets = data.assets;
    if (
        !release.assets.every(
            (asset) =>
                asset.sha256 &&
                assets.some((entry: unknown) => {
                    if (!entry || typeof entry !== 'object') return false;
                    const item = entry as Record<string, unknown>;
                    return item.name === asset.name && item.sha256 === asset.sha256;
                }),
        )
    )
        return null;
    const mac = data.mac as Record<string, unknown> | undefined;
    const windows = data.windows as Record<string, unknown> | undefined;
    return {
        macos:
            mac?.codeSigned === true && mac.notarized === true
                ? 'notarized'
                : mac?.codeSigned === false
                  ? 'unsigned'
                  : 'unknown',
        windows: windows?.codeSigned === true ? 'signed' : windows?.codeSigned === false ? 'unsigned' : 'unknown',
    };
}
