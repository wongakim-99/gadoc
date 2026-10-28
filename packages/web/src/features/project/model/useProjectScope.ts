'use client';

import { useCallback, useSyncExternalStore } from 'react';
const eventName = 'gadoc:project-scope';
export function useProjectScope(teamId: string) {
    const key = `gadoc:project-scope:${teamId}`;
    const subscribe = useCallback((notify: () => void) => {
        window.addEventListener(eventName, notify);
        window.addEventListener('storage', notify);
        return () => {
            window.removeEventListener(eventName, notify);
            window.removeEventListener('storage', notify);
        };
    }, []);
    const get = useCallback(() => {
        try {
            return localStorage.getItem(key) || '';
        } catch {
            return '';
        }
    }, [key]);
    const projectId = useSyncExternalStore(subscribe, get, () => '');
    const selectProject = useCallback(
        (id: string) => {
            try {
                localStorage.setItem(key, id);
            } catch {
                /* Navigation still works without storage. */
            }
            window.dispatchEvent(new Event(eventName));
        },
        [key],
    );
    return { projectId, selectProject };
}
