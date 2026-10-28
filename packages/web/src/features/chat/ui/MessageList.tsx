'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { useChatStore } from '../model/chat.store';
import { isNearBottom, useStickyScroll } from '../model/stickyScroll';
import type { ChannelViewportAnchor } from '../model/channelViewportAnchor';
import type { TeamMemberSummary } from '@/src/entities/team/types';

interface Props {
    currentUserId: string;
    members: TeamMemberSummary[];
    isRestoring?: boolean;
    restoreAnchor?: ChannelViewportAnchor | null;
    hasOlderMessages?: boolean;
    highlightMessageId?: string | null;
    isLoadingOlder?: boolean;
    onViewportAnchorChange?: (anchor: ChannelViewportAnchor | null) => void;
    onLoadOlder?: () => void | Promise<unknown>;
    onReact: (messageId: string, emoji: string) => void;
    onDelete: (messageId: string) => void;
    onEdit: (messageId: string, content: string) => Promise<void>;
    onOpenThread: (message: import('@/src/entities/message/types').Message) => void;
    onTogglePin: (message: import('@/src/entities/message/types').Message) => Promise<unknown>;
}

export function MessageList({
    currentUserId,
    members,
    isRestoring = false,
    restoreAnchor = null,
    hasOlderMessages = false,
    highlightMessageId = null,
    isLoadingOlder = false,
    onViewportAnchorChange,
    onLoadOlder,
    onReact,
    onDelete,
    onEdit,
    onOpenThread,
    onTogglePin,
}: Props) {
    const { messages, typingUsers, isLoading } = useChatStore();
    const lastScrolledHighlightRef = useRef<string | null>(null);

    // 스레드 답글 수를 로컬 store에서 실시간 계산
    const replyCountMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const msg of messages) {
            if (msg.replyToId) {
                map.set(msg.replyToId, (map.get(msg.replyToId) ?? 0) + 1);
            }
        }
        return map;
    }, [messages]);

    // 메인 메시지에 실시간 replyCount 반영
    const mainMessages = useMemo(
        () =>
            messages
                .filter((msg) => !msg.replyToId)
                .map((msg) => {
                    const liveCount = replyCountMap.get(msg.id) ?? 0;
                    const serverCount = msg.replyCount ?? 0;
                    const count = Math.max(liveCount, serverCount);
                    return count !== (msg.replyCount ?? 0) ? { ...msg, replyCount: count } : msg;
                }),
        [messages, replyCountMap],
    );
    const mainMessageIds = useMemo(() => mainMessages.map((message) => message.id), [mainMessages]);
    const { bottomRef, containerRef, handleScroll, prepareForPrepend, scrollToBottom, showJumpToLatest } =
        useStickyScroll({
            itemIds: mainMessageIds,
            ready: !isLoading && !isRestoring,
            restoreAnchor,
        });

    useEffect(() => {
        if (!onViewportAnchorChange || isLoading || isRestoring) return;

        const publishAnchor = () => {
            const container = containerRef.current;
            if (!container || mainMessages.length === 0) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const elements = new Map(
                Array.from(container.querySelectorAll<HTMLElement>('[id]')).map((element) => [element.id, element]),
            );
            const anchor =
                mainMessages.find((message) => {
                    const element = elements.get(`message-${message.id}`);
                    if (!element) return false;
                    const rect = element.getBoundingClientRect();
                    return rect.bottom >= containerRect.top + 12;
                }) ?? mainMessages[mainMessages.length - 1];

            const element = elements.get(`message-${anchor.id}`);
            onViewportAnchorChange({
                messageId: anchor.id,
                createdAt: anchor.createdAt,
                offset: element ? element.getBoundingClientRect().top - containerRect.top : 0,
                atBottom: isNearBottom(container, 2),
            });
        };

        publishAnchor();
        const container = containerRef.current;
        container?.addEventListener('scroll', publishAnchor, { passive: true });

        return () => {
            container?.removeEventListener('scroll', publishAnchor);
        };
    }, [containerRef, isLoading, isRestoring, mainMessages, onViewportAnchorChange]);

    useEffect(() => {
        if (!highlightMessageId || isLoading || isRestoring) return;
        if (lastScrolledHighlightRef.current === highlightMessageId) return;

        const frame = window.requestAnimationFrame(() => {
            const target = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[id]') ?? []).find(
                (element) => element.id === `message-${highlightMessageId}`,
            );
            if (!target) return;
            lastScrolledHighlightRef.current = highlightMessageId;
            const container = containerRef.current;
            if (container)
                container.scrollTo({
                    top:
                        container.scrollTop +
                        target.getBoundingClientRect().top -
                        container.getBoundingClientRect().top -
                        (container.clientHeight - target.clientHeight) / 2,
                    behavior: 'smooth',
                });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [containerRef, highlightMessageId, isLoading, isRestoring, mainMessageIds]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slack-green border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="relative min-h-0 flex-1">
            <div ref={containerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto py-2">
                {hasOlderMessages && onLoadOlder ? (
                    <div className="px-5 pb-2">
                        <button
                            type="button"
                            onClick={() => {
                                prepareForPrepend();
                                void onLoadOlder();
                            }}
                            disabled={isLoadingOlder}
                            className="w-full rounded-2xl border border-white/10 bg-bg-secondary/90 px-4 py-3 text-sm text-text-secondary transition hover:border-brand-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoadingOlder ? '이전 메시지 불러오는 중...' : '이전 메시지 더 보기'}
                        </button>
                    </div>
                ) : null}
                {mainMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                        아직 메시지가 없습니다. 첫 번째 메시지를 보내보세요!
                    </div>
                )}
                {mainMessages.map((msg) => (
                    <MessageItem
                        members={members}
                        key={msg.id}
                        highlighted={highlightMessageId === msg.id}
                        message={msg}
                        currentUserId={currentUserId}
                        onReact={onReact}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onOpenThread={onOpenThread}
                        onTogglePin={onTogglePin}
                    />
                ))}
                <TypingIndicator users={typingUsers} />
                <div ref={bottomRef} />
            </div>
            {showJumpToLatest && (
                <button
                    type="button"
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-4 rounded-full border border-brand-400/40 bg-bg-secondary/95 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/30 backdrop-blur transition hover:border-brand-300 hover:bg-bg-secondary"
                >
                    최신 메시지로 이동
                </button>
            )}
        </div>
    );
}
