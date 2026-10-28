'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const changed = 'gadoc:sidebar-collapse';
const fallback = new Map<string, boolean>();

export function useSidebarCollapse(teamId: string) {
    const key = `gadoc:sidebar-collapsed:${teamId}`;
    const subscribe = useCallback((notify: () => void) => {
        window.addEventListener('storage', notify);
        window.addEventListener(changed, notify);
        return () => {
            window.removeEventListener('storage', notify);
            window.removeEventListener(changed, notify);
        };
    }, []);
    const read = useCallback(() => {
        if (fallback.has(key)) return fallback.get(key)!;
        try { return window.localStorage.getItem(key) === 'true'; } catch { return fallback.get(key) ?? false; }
    }, [key]);
    const collapsed = useSyncExternalStore(subscribe, read, () => false);
    const setCollapsed = useCallback((value: boolean) => {
        fallback.set(key, value);
        try {
            window.localStorage.setItem(key, String(value));
            fallback.delete(key);
        } catch { /* Restricted storage uses memory. */ }
        window.dispatchEvent(new Event(changed));
    }, [key]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.code !== 'Backslash') return;
            if (!window.matchMedia('(min-width: 1024px)').matches) return;
            event.preventDefault();
            setCollapsed(!read());
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [read, setCollapsed]);
    return { collapsed, setCollapsed };
}
