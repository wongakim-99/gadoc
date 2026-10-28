'use client';

import { io, type Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api-client';
import { socketUrl } from '@/lib/runtime-config';
import { useProfileStore } from '@/src/entities/user/model/profile.store';
import type { UserIdentity } from '@/src/entities/user/types';

let socket: Socket | null = null;
let subscribers = 0;

export function retainProfileSync() {
    subscribers++;
    if (!socket) {
        socket = io(`${socketUrl()}/profile`, { transports: ['websocket'], withCredentials: true, reconnection: true });
        socket.on('profile_changed', ({ userId }: { userId?: string }) => {
            if (!userId || !/^[a-f0-9]{24}$/.test(userId)) return;
            void apiFetch<UserIdentity>(`/api/profile/${userId}`)
                .then((response) => {
                    if (response.success && response.data) useProfileStore.getState().apply([response.data]);
                })
                .catch(() => refresh());
        });
        socket.on('profile_ready', refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
    }
    return () => {
        if (--subscribers > 0) return;
        socket?.disconnect();
        socket = null;
        window.removeEventListener('focus', refresh);
        window.removeEventListener('online', refresh);
        useProfileStore.getState().clear();
    };
}

function refresh() {
    window.dispatchEvent(new Event('gadoc:profiles-refresh'));
}
