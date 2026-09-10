'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { channelApi, unwrapApiArray } from '@/lib/api-client';
import { getNotificationSocket, getWorkspaceChatSocket } from '@/lib/socket';
import { resolveChannelLabel } from '@/src/entities/channel/lib/resolveChannelLabel';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import type { Channel } from '@/src/entities/channel/types';
import type { Message } from '@/src/entities/message/types';
import { applyChannelRead, applyUnreadMessage } from '@/src/entities/channel/lib/syncChannelActivity';
import { notifyIncomingMessage } from '@/src/features/chat/model/notifyIncomingMessage';
import { setDesktopUnreadCount } from '@/src/shared/lib/desktop-badge';
import { workspaceChannelReadEvent, type WorkspaceChannelReadDetail } from './channelReadEvents';

interface Props {
    teamId: string;
    initialChannels: Channel[];
    members: TeamMemberSummary[];
    currentUserId: string;
    activeChannelId: string | null;
}

export function useWorkspaceChannels({ teamId, initialChannels, members, currentUserId, activeChannelId }: Props) {
    const [channels, setChannels] = useState(initialChannels);
    const membersRef = useRef(members);
    membersRef.current = members;
    const channelsRef = useRef(channels);
    channelsRef.current = channels;
    const channelIds = useMemo(() => channels.map((channel) => channel.id), [channels]);
    const channelIdsKey = channelIds.join(',');

    const refresh = useCallback(async () => {
        try {
            const response = await channelApi.getChannels(teamId);
            if (response.success) setChannels(unwrapApiArray<Channel>(response));
        } catch {
            /* Preserve the last known sidebar while reconnecting. */
        }
    }, [teamId]);

    useEffect(() => {
        setDesktopUnreadCount(
            `channels:${teamId}`,
            channels.reduce((sum, channel) => sum + (channel.unreadCount ?? 0), 0),
        );
    }, [channels, teamId]);
    useEffect(() => () => setDesktopUnreadCount(`channels:${teamId}`, 0), [teamId]);

    useEffect(() => {
        setChannels(initialChannels);
    }, [initialChannels]);

    useEffect(() => {
        if (!currentUserId) return;
        void refresh();
    }, [currentUserId, refresh]);

    useEffect(() => {
        const handleRead = (event: Event) => {
            const detail = (event as CustomEvent<WorkspaceChannelReadDetail>).detail;
            if (!detail) return;
            setChannels((current) => applyChannelRead(current, detail));
        };

        window.addEventListener(workspaceChannelReadEvent, handleRead as EventListener);
        return () => window.removeEventListener(workspaceChannelReadEvent, handleRead as EventListener);
    }, []);

    useEffect(() => {
        if (!currentUserId || channelIds.length === 0) return;
        const socket = getWorkspaceChatSocket();
        const joinedChannelIds = channelIdsKey.split(',').filter(Boolean);

        const joinRooms = () => joinedChannelIds.forEach((channelId) => socket.emit('join_channel', { channelId }));
        joinRooms();
        socket.on('connect', joinRooms);

        const handleNewMessage = (message: Message) => {
            const channel = channelsRef.current.find((channel) => channel.id === message.channelId);
            if (!channel || message.teamId !== teamId) return;
            const readingChannel =
                activeChannelId === message.channelId && document.visibilityState === 'visible' && document.hasFocus();
            if (!readingChannel)
                void notifyIncomingMessage(
                    message,
                    resolveChannelLabel(channel, membersRef.current, currentUserId),
                    currentUserId,
                );
            setChannels((current) =>
                applyUnreadMessage(current, {
                    message,
                    currentUserId,
                    activeChannelId,
                    isVisible: document.visibilityState === 'visible' && document.hasFocus(),
                }),
            );
        };

        socket.on('new_message', handleNewMessage);

        return () => {
            joinedChannelIds.forEach((channelId) => socket.emit('leave_channel', { channelId }));
            socket.off('new_message', handleNewMessage);
            socket.off('connect', joinRooms);
        };
    }, [activeChannelId, channelIds.length, channelIdsKey, currentUserId, teamId]);

    useEffect(() => {
        if (!currentUserId) return;

        const handleRefresh = () => {
            if (document.visibilityState === 'hidden') return;
            void refresh();
        };

        window.addEventListener('focus', handleRefresh);
        document.addEventListener('visibilitychange', handleRefresh);

        return () => {
            window.removeEventListener('focus', handleRefresh);
            document.removeEventListener('visibilitychange', handleRefresh);
        };
    }, [currentUserId, refresh]);

    useEffect(() => {
        if (!currentUserId) return;

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            void refresh();
        }, 2500);

        return () => window.clearInterval(interval);
    }, [currentUserId, refresh]);

    useEffect(() => {
        if (!currentUserId) return;

        const socket = getNotificationSocket();
        const handleNotificationChange = () => {
            void refresh();
        };

        socket.on('notification:new', handleNotificationChange);
        socket.on('notification:read', handleNotificationChange);
        socket.on('notification:read_all', handleNotificationChange);

        return () => {
            socket.off('notification:new', handleNotificationChange);
            socket.off('notification:read', handleNotificationChange);
            socket.off('notification:read_all', handleNotificationChange);
        };
    }, [currentUserId, refresh, teamId]);

    return { channels, refresh };
}
