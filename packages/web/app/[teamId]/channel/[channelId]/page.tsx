'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChannelRoom } from '@/src/features/chat/model/useChannelRoom';
import { useChatStore } from '@/src/features/chat/model/chat.store';
import {
    type ChannelViewportAnchor,
    readChannelViewportAnchor,
    writeChannelViewportAnchor,
} from '@/src/features/chat/model/channelViewportAnchor';
import { resolveViewportRestore, type RestoreTarget } from '@/src/features/chat/model/resolveViewportRestore';
import { useHuddle } from '@/src/features/huddle/model/useHuddle';
import { ChannelHeader } from '@/src/features/chat/ui/ChannelHeader';
import { ChannelArchiveDialog } from '@/src/features/chat/ui/ChannelArchiveDialog';
import { MessageList } from '@/src/features/chat/ui/MessageList';
import { MessageInput } from '@/src/features/chat/ui/MessageInput';
import { PinnedMessagesPanel } from '@/src/features/chat/ui/PinnedMessagesPanel';
import { ThreadPanel } from '@/src/features/chat/ui/ThreadPanel';
import { HuddlePanel } from '@/src/features/huddle/ui/HuddlePanel';
import { messageApi, unwrapApiData } from '@/lib/api-client';
import type { Message } from '@/src/entities/message/types';

interface Props {
    params: Promise<{ teamId: string; channelId: string }>;
}

export default function ChannelPage({ params }: Props) {
    const { teamId, channelId } = use(params);
    const searchParams = useSearchParams();
    const messageId = searchParams.get('message');
    const messageAt = searchParams.get('at');
    return (
        <ChannelRoom
            key={JSON.stringify([teamId, channelId, messageId, messageAt, searchParams.get('focus')])}
            teamId={teamId}
            channelId={channelId}
            targetMessageId={messageId}
            targetMessageAt={messageAt}
        />
    );
}

function ChannelRoom({
    teamId,
    channelId,
    targetMessageId,
    targetMessageAt,
}: {
    teamId: string;
    channelId: string;
    targetMessageId: string | null;
    targetMessageAt: string | null;
}) {
    const room = useChannelRoom(teamId, channelId);
    const messages = useChatStore((state) => state.messages);
    const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
    const [showPins, setShowPins] = useState(false);
    const [showChannelManagement, setShowChannelManagement] = useState(false);
    const [linkedMessage, setLinkedMessage] = useState<Message | null>(null);
    const [linkedParent, setLinkedParent] = useState<Message | null>(null);
    const [linkReady, setLinkReady] = useState(!targetMessageId || Boolean(targetMessageAt));
    const [linkError, setLinkError] = useState<string | null>(null);
    const threadMessage = useMemo(
        () => messages.find((message) => message.id === threadMessageId) ??
            (linkedParent?.id === threadMessageId ? linkedParent : null),
        [messages, threadMessageId, linkedParent],
    );
    const isLoading = useChatStore((state) => state.isLoading);
    const restoreTargetRef = useRef<RestoreTarget | null | undefined>(undefined);
    const loadingHistoryRef = useRef(false);
    const [restoration, setRestoration] = useState<{ ready: boolean; anchor: ChannelViewportAnchor | null }>({
        ready: false,
        anchor: null,
    });

    const huddle = useHuddle(room.currentUserId, channelId);
    const huddleActive = huddle.activeChannelId === channelId;

    useEffect(() => {
        if (!targetMessageId || targetMessageAt) return;
        let cancelled = false;
        void (async () => {
            try {
                const message = unwrapApiData<Message>(await messageApi.getMessage(channelId, targetMessageId));
                if (!message) throw new Error('missing');
                const parent = message.replyToId
                    ? unwrapApiData<Message>(await messageApi.getMessage(channelId, message.replyToId))
                    : null;
                if (cancelled) return;
                setLinkedMessage(message);
                setLinkedParent(parent);
                if (parent) setThreadMessageId(parent.id);
            } catch {
                if (!cancelled) setLinkError('메시지를 찾을 수 없거나 접근 권한이 없습니다.');
            } finally {
                if (!cancelled) setLinkReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, [channelId, targetMessageId, targetMessageAt]);

    const handleStartHuddle = () => {
        if (huddleActive) {
            huddle.leaveHuddle();
        } else {
            huddle.joinHuddle(channelId);
        }
    };

    useEffect(() => {
        if (!linkReady || restoration.ready || isLoading || !room.currentUserId || room.channel?.id !== channelId) return;
        if (restoreTargetRef.current === undefined) {
            const stored = readChannelViewportAnchor(teamId, channelId, room.currentUserId);
            restoreTargetRef.current =
                linkedParent || linkedMessage
                    ? { kind: 'message', messageId: (linkedParent ?? linkedMessage)!.id, createdAt: (linkedParent ?? linkedMessage)!.createdAt }
                    : targetMessageId && targetMessageAt
                    ? { kind: 'message', messageId: targetMessageId, createdAt: targetMessageAt }
                    : stored
                      ? { kind: 'message', ...stored }
                      : (room.channel.unreadCount ?? 0) > 0 && room.channel.lastReadAt
                        ? { kind: 'unread', after: room.channel.lastReadAt }
                        : null;
        }
        const target = restoreTargetRef.current;
        const result = target
            ? resolveViewportRestore(target, messages, room.hasOlderMessages)
            : { loadOlder: false, anchor: null };
        if (result.loadOlder) {
            if (room.isLoadingOlder || loadingHistoryRef.current) return;
            loadingHistoryRef.current = true;
            void room
                .loadOlderMessages()
                .catch(() => {
                    setRestoration({ ready: true, anchor: null });
                })
                .finally(() => {
                    loadingHistoryRef.current = false;
                });
            return;
        }
        setRestoration({ ready: true, anchor: result.anchor });
    }, [
        channelId,
        isLoading,
        messages,
        restoration.ready,
        room.channel,
        room.currentUserId,
        room.hasOlderMessages,
        room.isLoadingOlder,
        room.loadOlderMessages,
        targetMessageAt,
        targetMessageId,
        teamId,
        linkReady,
        linkedMessage,
        linkedParent,
    ]);

    const persistAnchor = useCallback(
        (anchor: ChannelViewportAnchor | null) => {
            if (restoration.ready && room.currentUserId && anchor) {
                writeChannelViewportAnchor(teamId, channelId, anchor, room.currentUserId);
            }
        },
        [channelId, restoration.ready, room.currentUserId, teamId],
    );

    return (
        <div className="flex flex-col h-full">
            <ChannelHeader
                canStartHuddle={room.canWrite}
                isArchived={room.channel?.isArchived}
                onManageChannel={room.canManageChannel ? () => setShowChannelManagement(true) : undefined}
                channelName={room.channelLabel}
                channelType={room.channel?.type}
                onOpenPins={() => setShowPins(true)}
                onStartHuddle={handleStartHuddle}
                huddleActive={huddleActive}
                huddleReady={huddle.socketReady}
            />
            {linkError && <p role="alert" className="px-4 py-2 text-sm text-text-secondary">{linkError}</p>}
            {room.channel?.isArchived && <p className="border-b border-border-primary px-4 py-2 text-sm text-text-secondary">보관된 채널입니다. 기존 메시지는 계속 확인할 수 있습니다.</p>}
            {showChannelManagement && <ChannelArchiveDialog teamId={teamId} channelId={channelId} name={room.channelLabel} description={room.channel?.description ?? ''} archived={Boolean(room.channel?.isArchived)} onClose={() => setShowChannelManagement(false)} />}
            <div className="flex min-h-0 flex-1">
                <div className="flex min-h-0 flex-1 flex-col">
                    <MessageList
                        currentUserId={room.currentUserId}
                        hasOlderMessages={room.hasOlderMessages}
                        highlightMessageId={targetMessageId}
                        isRestoring={!restoration.ready}
                        restoreAnchor={restoration.anchor}
                        isLoadingOlder={room.isLoadingOlder}
                        onLoadOlder={room.loadOlderMessages}
                        onViewportAnchorChange={persistAnchor}
                        onReact={room.reactToMessage}
                        onDelete={room.deleteMessage}
                        onEdit={room.editMessage}
                        onOpenThread={(message) => setThreadMessageId(message.id)}
                        onTogglePin={room.togglePinMessage}
                    />
                    <MessageInput
                        draftScope={{ userId: room.currentUserId, teamId, channelId }}
                        channelName={room.channelLabel}
                        members={room.members}
                        readOnly={!room.canWrite}
                        readOnlyMessage={room.channel?.isArchived ? '보관된 채널은 읽기 전용입니다.' : undefined}
                        onSend={(content) => room.sendMessage(content)}
                        onUpload={(files, content) => room.sendAttachments(files, content)}
                        onTyping={room.sendTyping}
                        isUploading={room.isUploading}
                    />
                </div>
                {showPins && (
                    <PinnedMessagesPanel
                        channelId={channelId}
                        onClose={() => setShowPins(false)}
                        onOpenThread={(message) => setThreadMessageId(message.id)}
                        onTogglePin={room.togglePinMessage}
                    />
                )}
                {threadMessage && (
                    <ThreadPanel
                        key={threadMessage.id}
                        teamId={teamId}
                        canWrite={room.canWrite}
                        channelId={channelId}
                        parentMessage={threadMessage}
                        highlightMessageId={linkedMessage?.replyToId ? linkedMessage.id : null}
                        currentUserId={room.currentUserId}
                        onClose={() => setThreadMessageId(null)}
                        onSendReply={room.sendMessage}
                        onUploadReply={room.sendAttachments}
                        onDelete={room.deleteMessage}
                        isUploading={room.isUploading}
                        onReact={room.reactToMessage}
                        onEdit={room.editMessage}
                        onTogglePin={room.togglePinMessage}
                    />
                )}
            </div>
            {room.currentUserId && (
                <HuddlePanel
                    activeChannelId={huddle.activeChannelId}
                    participants={huddle.participants}
                    localStream={huddle.localStream}
                    localAudio={huddle.localAudio}
                    localVideo={huddle.localVideo}
                    sharingScreen={huddle.sharingScreen}
                    error={huddle.error}
                    clearError={huddle.clearError}
                    leaveHuddle={huddle.leaveHuddle}
                    toggleAudio={huddle.toggleAudio}
                    toggleVideo={huddle.toggleVideo}
                    toggleScreenShare={huddle.toggleScreenShare}
                    currentUsername={room.currentUsername || room.channelLabel}
                    channelName={room.channelLabel}
                />
            )}
        </div>
    );
}
