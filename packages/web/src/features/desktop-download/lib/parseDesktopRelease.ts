export interface DesktopRelease {
    version: string;
    assets: { name: string; href: string; bytes?: number; sha256?: string }[];
}

// 공개된 정식 릴리즈에서 업로드가 끝난 설치 파일만 링크로 사용한다.
export function parseDesktopRelease(value: unknown): DesktopRelease | null {
    if (!value || typeof value !== 'object') return null;
    const release = value as Record<string, unknown>;
    if (
        release.draft !== false ||
        release.prerelease !== false ||
        typeof release.tag_name !== 'string' ||
        !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
        !Array.isArray(release.assets)
    )
        return null;

    const version = release.tag_name.slice(1);
    const prefixes = ['gadoc', 'slacord'].map(
        (repo) => `https://github.com/kscold/${repo}/releases/download/${release.tag_name}/`,
    );
    const names = new Set(
        ['GaDoc', 'Slacord'].flatMap((brand) =>
            ['x64.exe', 'arm64.dmg', 'arm64.zip'].map((suffix) => `${brand}-${version}-${suffix}`),
        ),
    );
    const assets = release.assets.flatMap((value: unknown) => {
        if (!value || typeof value !== 'object') return [];
        const asset = value as Record<string, unknown>;
        if (
            asset.state !== 'uploaded' ||
            typeof asset.name !== 'string' ||
            !names.has(asset.name) ||
            !prefixes.some((prefix) => asset.browser_download_url === `${prefix}${asset.name}`) ||
            typeof asset.size !== 'number' ||
            !Number.isSafeInteger(asset.size) ||
            asset.size <= 0
        )
            return [];
        return [
            {
                name: asset.name,
                href: asset.browser_download_url as string,
                bytes: asset.size,
                ...(typeof asset.digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(asset.digest)
                    ? { sha256: asset.digest.slice(7) }
                    : {}),
            },
        ];
    });
    return assets.length ? { version, assets } : null;
}
