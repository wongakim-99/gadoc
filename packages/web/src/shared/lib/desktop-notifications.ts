const delivered = new Map<string, number>();

export async function showDesktopMessageNotification(input: {
    title: string;
    body: string;
    force?: boolean;
    href?: string;
    id?: string;
    teamId?: string;
}) {
    if (typeof window === 'undefined') return;
    const native = window.slacordDesktop?.isDesktop && typeof window.slacordDesktop.notify === 'function';
    if (!native) {
        if (!input.force && document.visibilityState === 'visible' && document.hasFocus()) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
    }
    if (input.id) {
        const now = Date.now();
        if (now - (delivered.get(input.id) ?? 0) < 60_000) return;
        delivered.set(input.id, now);
        for (const [key, time] of delivered) if (now - time >= 60_000) delivered.delete(key);
        if (delivered.size > 500) delivered.delete(delivered.keys().next().value!);
    }
    try {
        if (input.id && input.teamId) {
            // Prefer a running desktop client; every context still claims atomically.
            if (!native) await new Promise((resolve) => setTimeout(resolve, 300));
            const response = await fetch(`/api/team/${encodeURIComponent(input.teamId)}/notification/delivery-claim`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: input.id }),
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok || !(await response.json()).data?.deliver) return;
        }
        if (native) {
            await window.slacordDesktop!.notify(input.title, input.body, input.href);
            return;
        }
        if (!input.force && document.visibilityState === 'visible' && document.hasFocus()) return;
        // Browser permissions must be requested from a user gesture, never an
        // unsolicited socket event. Desktop permissions are handled by the OS.
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const notification = new Notification(input.title, {
            body: input.body,
            icon: '/brand/gadoc-icon.png',
            tag: input.id,
        });
        notification.onclick = () => {
            window.focus();
            if (input.href) {
                const target = new URL(input.href, location.origin);
                if (target.origin === location.origin) location.assign(target.href);
            }
            notification.close();
        };
    } catch {
        /* Notification failures must not break message delivery. */
    }
}
