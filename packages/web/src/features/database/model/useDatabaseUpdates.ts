'use client';

import { useEffect, useRef } from 'react';
import { subscribeDatabaseChanges } from './databaseSocket';

interface DatabaseUpdate {
    teamId: string;
    databaseId: string;
    sender: string;
}
const eventName = 'slacord:database-updated';

// Notify connected views, including the other split pane. Every recipient reloads
// through its authenticated API; no document values are sent across windows.
export function useDatabaseUpdates(teamId: string, databaseId: string | null, reload: () => Promise<void>) {
    const sender = useRef<string>('');
    const latestReload = useRef(reload);
    latestReload.current = reload;
    const channel = useRef<BroadcastChannel | null>(null);
    useEffect(() => {
        sender.current = crypto.randomUUID();
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const receive = (data: DatabaseUpdate) => {
            if (
                !active ||
                data?.teamId !== teamId ||
                (databaseId !== null && data.databaseId !== databaseId) ||
                data.sender === sender.current
            )
                return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (active) void latestReload.current().catch(() => undefined);
            }, 100);
        };
        const handler = (event: Event) => receive((event as CustomEvent<DatabaseUpdate>).detail);
        window.addEventListener(eventName, handler);
        const unsubscribe = subscribeDatabaseChanges(teamId, () =>
            receive({ teamId, databaseId: databaseId ?? '', sender: 'server' }),
        );
        if (typeof BroadcastChannel !== 'undefined') {
            channel.current = new BroadcastChannel(eventName);
            channel.current.onmessage = (event) => receive(event.data);
        }
        return () => {
            active = false;
            unsubscribe();
            clearTimeout(timer);
            window.removeEventListener(eventName, handler);
            channel.current?.close();
            channel.current = null;
        };
    }, [teamId, databaseId]);
    return () => {
        if (!databaseId) return;
        const data: DatabaseUpdate = { teamId, databaseId, sender: sender.current };
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
        channel.current?.postMessage(data);
    };
}
