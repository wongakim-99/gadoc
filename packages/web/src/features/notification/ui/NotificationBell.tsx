'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useNotifications } from '../model/useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { resolveNotificationHref } from '@/src/entities/notification/lib/resolveNotificationHref';
import type { AppNotification } from '@/src/entities/notification/types';

interface Props {
    teamId: string;
    compact?: boolean;
}

export function NotificationBell({ teamId, compact = false }: Props) {
    const router = useRouter();
    const { notifications, unreadCount, error, markAsRead, markAllAsRead } = useNotifications(teamId);
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const panelId = useId();

    const openNotification = (notification: AppNotification) => {
        setOpen(false);
        const href = resolveNotificationHref(teamId, notification);
        // Reopening the same notification should restore a thread the user has closed.
        router.push(notification.resourceType === 'message' && notification.channelId
            ? `${href}&focus=${Date.now()}`
            : href);
    };

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                onClick={() => setOpen(!open)}
                aria-controls={panelId}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={unreadCount ? `알림 ${unreadCount}개 읽지 않음` : '알림'}
                title="알림"
                className={
                    compact
                        ? 'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-bg-hover'
                        : 'workspace-sidebar-row flex w-full items-center text-text-secondary hover:bg-bg-hover'
                }
            >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                {!compact && <span className="flex-1 text-left">알림</span>}
                {unreadCount > 0 && (
                    <span
                        className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${compact ? 'absolute -right-1 -top-1' : ''}`}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* 패널은 항상 fixed 오버레이로 — sidebar nav 안에 인라인 렌더링되지 않도록 */}
            {open &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex">
                        {/* 뒷배경 오버레이 (클릭 시 닫힘) */}
                        <div className="flex-1" onClick={() => setOpen(false)} />
                        <NotificationPanel
                            ref={panelRef}
                            id={panelId}
                            open={open}
                            notifications={notifications}
                            error={error}
                            onClose={() => setOpen(false)}
                            onMarkAsRead={markAsRead}
                            onMarkAllAsRead={markAllAsRead}
                            onOpen={openNotification}
                            restoreFocusRef={triggerRef}
                        />
                    </div>,
                    document.body,
                )}
        </>
    );
}
