'use client';

import { NotificationPermissionButton } from './NotificationPermissionButton';
import { forwardRef, useId, useRef, useState, type RefObject } from 'react';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import { formatShortDateTime } from '@/src/shared/lib/datetime';
import type { AppNotification } from '@/src/entities/notification/types';
import { buildNotificationCopy } from '@/src/entities/notification/lib/buildNotificationCopy';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

interface Props {
    onDelete: (id?: string) => Promise<void>;
    id?: string;
    error?: string | null;
    notifications: AppNotification[];
    onClose: () => void;
    onMarkAsRead: (id: string) => Promise<void> | void;
    onMarkAllAsRead: () => Promise<void> | void;
    onOpen: (notification: AppNotification) => void;
    open: boolean;
    restoreFocusRef?: RefObject<HTMLElement | null>;
}

export const NotificationPanel = forwardRef<HTMLElement, Props>(function NotificationPanel(
    { id, error, notifications, onClose, onMarkAsRead, onMarkAllAsRead, onDelete, onOpen, open, restoreFocusRef },
    ref,
) {
    const surfaceRef = useRef<HTMLElement>(null);
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const markAllButtonRef = useRef<HTMLButtonElement>(null);
    const [deleting, setDeleting] = useState(false);
    const remove = async (id?: string) => {
        if (deleting || (!id && !window.confirm('이 워크스페이스의 내 알림을 모두 삭제할까요?'))) return;
        setDeleting(true);
        try { await onDelete(id); } finally { setDeleting(false); }
    };

    useDialogFocusTrap({
        initialFocusRef: notifications.length > 0 ? markAllButtonRef : closeButtonRef,
        onEscape: onClose,
        open,
        restoreFocusRef,
        surfaceRef,
    });

    return (
        <aside
            id={id}
            ref={(node) => {
                surfaceRef.current = node;
                if (typeof ref === 'function') {
                    ref(node);
                    return;
                }
                if (ref) {
                    ref.current = node;
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="flex h-full w-80 flex-col bg-bg-primary outline-none border-l border-border-primary"
        >
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3 shrink-0">
                <h3 id={titleId} className="text-base font-bold text-white">
                    알림
                </h3>
                <div className="flex items-center gap-2">
                    <button type="button" disabled={deleting || !notifications.length} onClick={() => void remove()}
                        className="text-xs text-text-tertiary hover:text-text-primary disabled:opacity-40">전체 삭제</button>
                    <button
                        ref={markAllButtonRef}
                        onClick={onMarkAllAsRead}
                        className="text-xs text-text-tertiary hover:text-white transition-colors"
                    >
                        전체 읽음
                    </button>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        aria-label="알림 패널 닫기"
                        className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>
            <NotificationPermissionButton />
            <div className="flex-1 overflow-y-auto">
                {error && (
                    <p role="alert" className="px-4 py-3 text-sm text-red-300">
                        {error}
                    </p>
                )}
                {notifications.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-text-tertiary">알림이 없습니다.</p>
                )}
                {notifications.map((n) => {
                    const copy = buildNotificationCopy(n);
                    const time = formatShortDateTime(n.createdAt);
                    return (
                        <div key={n.id} className="flex items-center border-b border-border-primary">
                        <button
                            onClick={async () => {
                                try {
                                    if (!n.isRead) await onMarkAsRead(n.id);
                                } catch {
                                    // 읽음 처리 실패해도 알림은 열어줌
                                }
                                onOpen(n);
                            }}
                            className={`min-w-0 flex-1 flex gap-3 px-4 py-3 text-left hover:bg-bg-hover ${n.isRead ? 'opacity-60' : ''}`}
                        >
                            {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2" />}
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: getAvatarColor(n.actorId) }}
                            >
                                {copy.actorName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[13px] font-semibold text-white">{copy.actorName}</span>
                                    <span className="text-[11px] text-text-tertiary">{copy.typeLabel}</span>
                                </div>
                                <p className="mt-0.5 text-[13px] text-text-secondary line-clamp-2">{copy.body}</p>
                                <p className="mt-1 text-[11px] text-text-tertiary">{time}</p>
                            </div>
                        </button>
                        <button type="button" disabled={deleting} onClick={() => void remove(n.id)} aria-label={`${copy.body} 알림 삭제`}
                            className="mr-2 shrink-0 rounded px-2 py-2 text-xs text-text-tertiary hover:bg-bg-hover hover:text-error disabled:opacity-40">삭제</button>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
});
