import { parseDesktopRelease } from '../lib/parseDesktopRelease';

export async function getDesktopRelease() {
    try {
        const response = await fetch('https://api.github.com/repos/kscold/slacord/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' },
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        return parseDesktopRelease(await response.json());
    } catch {
        return null;
    }
}
