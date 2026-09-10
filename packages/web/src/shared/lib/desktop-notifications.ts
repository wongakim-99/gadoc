const delivered = new Map<string, number>();

export async function showDesktopMessageNotification(input: {
    title: string;
    body: string;
    force?: boolean;
    href?: string;
    id?: string;
}) {
    if (typeof window === 'undefined') return;
    if (input.id) {
        const now = Date.now();
        if (now - (delivered.get(input.id) ?? 0) < 60_000) return;
        delivered.set(input.id, now);
        for (const [key, time] of delivered) if (now - time >= 60_000) delivered.delete(key);
        if (delivered.size > 500) delivered.delete(delivered.keys().next().value!);
    }
    try {
        if (window.slacordDesktop?.isDesktop && typeof window.slacordDesktop.notify === 'function') {
            await window.slacordDesktop.notify(input.title, input.body, input.href);
            return;
        }
        if (!input.force && document.visibilityState === 'visible' && document.hasFocus()) return;
        // Browser permissions must be requested from a user gesture, never an
        // unsolicited socket event. Desktop permissions are handled by the OS.
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const notification = new Notification(input.title, { body: input.body, icon: '/assets/slacord-bot-icon.png' });
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
