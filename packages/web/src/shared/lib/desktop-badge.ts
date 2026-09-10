const counts = new Map<string, number>();

export function setDesktopUnreadCount(source: string, count: number) {
    if (count > 0) counts.set(source, count);
    else counts.delete(source);
    if (typeof window !== 'undefined') {
        void window.slacordDesktop
            ?.setBadgeCount?.([...counts.values()].reduce((sum, value) => sum + value, 0))
            .catch(() => undefined);
    }
}
