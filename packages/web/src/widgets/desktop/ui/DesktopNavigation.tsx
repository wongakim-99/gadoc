'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Optional bridge methods let old Windows/macOS shells keep loading new web builds. */
export function DesktopNavigation() {
    const router = useRouter();
    useEffect(
        () =>
            window.slacordDesktop?.onNavigate?.((href) => {
                try {
                    const url = new URL(href, location.origin);
                    if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash);
                } catch {
                    /* Ignore malformed routes from stale notifications. */
                }
            }),
        [router],
    );
    return null;
}
