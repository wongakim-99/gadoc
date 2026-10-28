'use client';

import { useEffect, useMemo, useState } from 'react';
import { messageApi, unwrapApiArray } from '@/lib/api-client';
import type { Message } from '@/src/entities/message/types';
import { useChatStore } from '../model/chat.store';
import { useStickyScroll } from '../model/stickyScroll';
import { MessageInput } from './MessageInput';
import { MessageItem } from './MessageItem';
import { getChatSocket } from '../model/socket';

interface Props {
    highlightMessageId?: string | null;
    onReact: (messageId: string, emoji: string) => void;
    onEdit: (messageId: string, content: string) => Promise<void>;
    onTogglePin: (message: Message) => Promise<unknown>;
    canWrite: boolean;
    channelId: string;
    teamId: string;
    parentMessage: Message;
    currentUserId: string;
    onClose: () => void;
    onSendReply: (content: string, replyToId: string) => void | Promise<void>;
    onUploadReply: (files: File[], content: string, replyToId: string) => Promise<void>;
    onDelete: (messageId: string) => void;
    isUploading: boolean;
}

export function ThreadPanel({
    highlightMessageId,
    onReact,
    onEdit,
    onTogglePin,
    canWrite,
    channelId,
    teamId,
    parentMessage,
    currentUserId,
    onClose,
    onSendReply,
    onUploadReply,
    onDelete,
    isUploading,
}: Props) {
    const allMessages = useChatStore((state) => state.messages);
    const liveReplies = useMemo(
        () => allMessages.filter((m) => m.channelId === channelId && m.replyToId === parentMessage.id),
        [allMessages, channelId, parentMessage.id],
    );
    const [loadError, setLoadError] = useState('');
    const [reload, setReload] = useState(0);

    const mergedReplies = useMemo(() => {
        return [...liveReplies].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, [liveReplies]);
    const replyIds = useMemo(() => mergedReplies.map((message) => message.id), [mergedReplies]);
    const { bottomRef, containerRef, handleScroll, scrollToBottom, showJumpToLatest } = useStickyScroll({
        itemIds: replyIds,
    });

    useEffect(() => {
        let active = true;
        const deleted = new Set<string>();
        const socket = getChatSocket();
        const onDeleted = ({ messageId }: { messageId: string }) => deleted.add(messageId);
        socket.on('message_deleted', onDeleted);
        setLoadError('');
        messageApi.getThreadMessages(channelId, parentMessage.id).then((response) => {
            if (!active) return;
            const state = useChatStore.getState();
            const current = new Map(state.messages.map((message) => [message.id, message]));
            for (const message of unwrapApiArray<Message>(response)) {
                if (deleted.has(message.id)) continue;
                const latest = current.get(message.id);
                if (!latest || latest.updatedAt < message.updatedAt) current.set(message.id, message);
            }
            state.setMessages([...current.values()]);
        }).catch(() => { if (active) setLoadError('답글을 불러오지 못했습니다.'); });
        return () => { active = false; socket.off('message_deleted', onDeleted); };
    }, [channelId, parentMessage.id, reload]);

    useEffect(() => {
        if (!highlightMessageId || !replyIds.includes(highlightMessageId)) return;
        const element = containerRef.current?.querySelector(`[id="thread-message-${highlightMessageId}"]`);
        element?.scrollIntoView({ block: 'center' });
    }, [highlightMessageId, replyIds, containerRef]);

    const renderMessage = (message: Message) => <MessageItem
        key={message.id} idPrefix="thread-message" message={message} currentUserId={currentUserId}
        highlighted={highlightMessageId === message.id}
        onReact={(id, emoji) => { if (canWrite) onReact(id, emoji); }}
        onDelete={canWrite && message.authorId === currentUserId ? onDelete : undefined}
        onEdit={canWrite && message.authorId === currentUserId ? onEdit : undefined}
        onTogglePin={canWrite ? onTogglePin : undefined}
    />;

    return (
        <aside aria-label="스레드" className="fixed inset-0 z-50 flex flex-col bg-bg-primary lg:static lg:z-auto lg:w-96 lg:shrink-0 lg:border-l lg:border-border-primary">
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3 shrink-0">
                <h3 className="text-base font-bold text-white">스레드</h3>
                <button
                    aria-label="스레드 닫기"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="relative min-h-0 flex-1">
                <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
                    <div className="border-b border-border-primary pb-3 pt-4">
                        {renderMessage(parentMessage)}
                        {mergedReplies.length > 0 && (
                            <p className="mt-3 px-4 text-[12px] text-text-tertiary">{mergedReplies.length}개의 답글</p>
                        )}
                    </div>

                    <div className="py-1">
                        {mergedReplies.map(renderMessage)}
                        {loadError && <div role="alert" className="px-4 py-2 text-sm text-error">{loadError}
                            <button type="button" className="ml-2 underline" onClick={() => setReload((value) => value + 1)}>다시 시도</button>
                        </div>}
                        {mergedReplies.length === 0 && (
                            <p className="px-4 py-8 text-center text-sm text-text-tertiary">아직 답글이 없습니다.</p>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </div>
                {showJumpToLatest && (
                    <button
                        type="button"
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-4 rounded-full border border-brand-400/40 bg-bg-secondary/95 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/30 backdrop-blur transition hover:border-brand-300 hover:bg-bg-secondary"
                    >
                        최신 답글로 이동
                    </button>
                )}
            </div>

            <MessageInput
                draftScope={{ userId: currentUserId, teamId, channelId, threadId: parentMessage.id }}
                channelName="스레드"
                readOnly={!canWrite}
                readOnlyMessage="현재 채널은 읽기 전용입니다."
                onSend={(content) => onSendReply(content, parentMessage.id)}
                onUpload={(files, content) => onUploadReply(files, content, parentMessage.id)}
                onTyping={() => {}}
                isUploading={isUploading}
            />
        </aside>
    );
}
