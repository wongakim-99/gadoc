export interface DesktopRelease {
    version: string;
    assets: { name: string; href: string }[];
}

// Only uploaded installers from a public stable release may become download links.
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
    const prefix = `https://github.com/kscold/slacord/releases/download/${release.tag_name}/`;
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
            asset.browser_download_url !== `${prefix}${asset.name}` ||
            typeof asset.size !== 'number' ||
            asset.size <= 0
        )
            return [];
        return [{ name: asset.name, href: asset.browser_download_url as string }];
    });
    return assets.length ? { version, assets } : null;
}
