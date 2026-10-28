'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationApi, unwrapApiArray, unwrapApiData } from '@/lib/api-client';
import type { AppNotification } from '@/src/entities/notification/types';
import { getNotificationSocket } from '@/lib/socket';
import {
    applyNotificationRead,
    applyNotificationReadAll,
    prependNotification,
} from '@/src/entities/notification/lib/syncNotifications';
import { setDesktopUnreadCount } from '@/src/shared/lib/desktop-badge';
import { notifyAppNotification } from './notifyAppNotification';

export function useNotifications(teamId: string) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(0);
    const activeTeam = useRef(teamId);
    activeTeam.current = teamId;

    const load = useCallback(async () => {
        if (activeTeam.current !== teamId) return;
        const request = ++sequence.current;
        try {
            const [listRes, countRes] = await Promise.all([
                notificationApi.getNotifications(teamId),
                notificationApi.getUnreadCount(teamId),
            ]);
            if (request !== sequence.current || activeTeam.current !== teamId) return;
            if (!listRes.success || !countRes.success) throw new Error('알림을 불러오지 못했습니다.');
            setNotifications(unwrapApiArray<AppNotification>(listRes));
            const count = unwrapApiData<{ count: number }>(countRes);
            if (count) setUnreadCount(count.count);
            setError(null);
        } catch {
            if (request === sequence.current && activeTeam.current === teamId) setError('알림을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            if (request === sequence.current && activeTeam.current === teamId) setLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        setDesktopUnreadCount(`notifications:${teamId}`, unreadCount);
    }, [teamId, unreadCount]);

    useEffect(() => {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(true);
        const socket = getNotificationSocket();
        const seen = new Set<string>();
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        const scheduleRefresh = () => {
            ++sequence.current; // An older HTTP snapshot must not erase a live event.
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => void load(), 150);
        };
        const joinRoom = () => socket.emit('join_team_notifications', { teamId });
        const handleJoined = (data: { teamId: string }) => {
            if (data.teamId === teamId) void load();
        };
        const handleNew = (notification: AppNotification) => {
            if (notification.teamId !== teamId || seen.has(notification.id)) return;
            seen.add(notification.id);
            if (seen.size > 1000) seen.delete(seen.values().next().value!);
            setNotifications((prev) => prependNotification(prev, notification));
            if (!notification.isRead) {
                setUnreadCount((count) => count + 1);
                void notifyAppNotification(notification);
            }
            scheduleRefresh();
        };
        const handleRead = ({ id }: { id: string }) => {
            setNotifications((prev) => applyNotificationRead(prev, id));
            scheduleRefresh(); // Count comes from the server: repeated read events are idempotent.
        };
        const handleReadAll = () => {
            setNotifications((prev) => applyNotificationReadAll(prev));
            setUnreadCount(0);
            scheduleRefresh();
        };
        socket.on('connect', joinRoom);
        socket.on('joined_team_notifications', handleJoined);
        socket.on('notification:new', handleNew);
        socket.on('notification:read', handleRead);
        socket.on('notification:read_all', handleReadAll);
        joinRoom();
        void load();
        return () => {
            ++sequence.current;
            clearTimeout(refreshTimer);
            setDesktopUnreadCount(`notifications:${teamId}`, 0);
            socket.emit('leave_team_notifications', { teamId });
            socket.off('connect', joinRoom);
            socket.off('joined_team_notifications', handleJoined);
            socket.off('notification:new', handleNew);
            socket.off('notification:read', handleRead);
            socket.off('notification:read_all', handleReadAll);
        };
    }, [load, teamId]);

    const markAsRead = async (id: string) => {
        const result = await notificationApi.markAsRead(teamId, id);
        if (activeTeam.current !== teamId) return;
        if (!result.success) throw new Error('알림을 읽음 처리하지 못했습니다.');
        setNotifications((prev) => applyNotificationRead(prev, id));
        await load();
    };
    const markAllAsRead = async () => {
        try {
            const result = await notificationApi.markAllAsRead(teamId);
            if (activeTeam.current !== teamId) return;
            if (!result.success) throw new Error();
            setNotifications((prev) => applyNotificationReadAll(prev));
            await load();
        } catch {
            if (activeTeam.current === teamId) setError('알림을 읽음 처리하지 못했습니다. 다시 시도해주세요.');
        }
    };
    const deleteNotification = async (id?: string) => {
        try {
            const result = await notificationApi.deleteNotification(teamId, id);
            if (activeTeam.current !== teamId) return false;
            if (!result.success) throw new Error('알림을 삭제하지 못했습니다.');
            ++sequence.current;
            setNotifications((items) => id ? items.filter(item => item.id !== id) : []);
            await load();
            return true;
        } catch {
            if (activeTeam.current === teamId) setError('알림을 삭제하지 못했습니다. 다시 시도해 주세요.');
            return false;
        }
    };
    return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, deleteNotification, refresh: load };
}
