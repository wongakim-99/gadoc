'use client';
import { io, type Socket } from 'socket.io-client';
import { socketUrl } from '@/lib/runtime-config';
let socket: Socket | null = null;
const subscriptions = new Map<string, Set<() => void>>();
export function subscribeDatabaseChanges(teamId: string, notify: () => void) {
    let callbacks = subscriptions.get(teamId);
    if (!callbacks) {
        callbacks = new Set();
        subscriptions.set(teamId, callbacks);
    }
    callbacks.add(notify);
    if (!socket) {
        socket = io(`${socketUrl()}/database`, {
            path: '/socket.io',
            transports: ['websocket'],
            withCredentials: true,
            reconnection: true,
        });
        socket.on('connect', () => {
            for (const id of subscriptions.keys()) socket?.emit('database:subscribe', { teamId: id });
        });
        socket.on('database:changed', (data: { teamId?: string }) => {
            if (typeof data?.teamId === 'string')
                for (const callback of subscriptions.get(data.teamId) ?? []) callback();
        });
    }
    if (socket.connected) socket.emit('database:subscribe', { teamId });
    return () => {
        callbacks?.delete(notify);
        if (!callbacks?.size) {
            subscriptions.delete(teamId);
            socket?.emit('database:unsubscribe', { teamId });
        }
        if (!subscriptions.size) {
            socket?.disconnect();
            socket = null;
        }
    };
}
