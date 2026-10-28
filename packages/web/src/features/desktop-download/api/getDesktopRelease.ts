import { parseDesktopRelease } from '../lib/parseDesktopRelease';
import {
    parseDesktopVerification,
    snapshotVerification,
    verifiedDesktopRelease,
    type DesktopReleaseDetails,
} from '../lib/verifiedDesktopRelease';

export async function getDesktopRelease(): Promise<DesktopReleaseDetails> {
    try {
        const response = await fetch('https://api.github.com/repos/kscold/gadoc/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' },
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
            const raw = await response.json();
            const release = parseDesktopRelease(raw);
            if (release) {
                let verification = snapshotVerification(release);
                const proof = raw.assets.find(
                    (asset: Record<string, unknown>) =>
                        asset.name === 'desktop-verification.json' &&
                        asset.state === 'uploaded' &&
                        typeof asset.size === 'number' &&
                        asset.size > 0 &&
                        asset.size < 16384 &&
                        asset.browser_download_url ===
                            `https://github.com/kscold/gadoc/releases/download/v${release.version}/desktop-verification.json`,
                );
                if (proof) {
                    try {
                        const response = await fetch(proof.browser_download_url, {
                            next: { revalidate: 300 },
                            signal: AbortSignal.timeout(5000),
                        });
                        if (response.ok)
                            verification = parseDesktopVerification(await response.json(), release) ?? verification;
                    } catch {
                        /* 공증 근거 조회 실패는 설치 링크까지 숨기지 않는다. */
                    }
                }
                return { ...release, source: 'github', verification };
            }
        }
    } catch {
        /* 오프라인 빌드·시간 초과·API 한도에도 검증한 설치 파일을 보존한다. */
    }
    return structuredClone(verifiedDesktopRelease);
}
