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
import { MessageList } from '@/src/features/chat/ui/MessageList';
import { MessageInput } from '@/src/features/chat/ui/MessageInput';
import { PinnedMessagesPanel } from '@/src/features/chat/ui/PinnedMessagesPanel';
import { ThreadPanel } from '@/src/features/chat/ui/ThreadPanel';
import { HuddlePanel } from '@/src/features/huddle/ui/HuddlePanel';

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
            key={JSON.stringify([teamId, channelId, messageId, messageAt])}
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
    const threadMessage = useMemo(
        () => messages.find((message) => message.id === threadMessageId) ?? null,
        [messages, threadMessageId],
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

    const handleStartHuddle = () => {
        if (huddleActive) {
            huddle.leaveHuddle();
        } else {
            huddle.joinHuddle(channelId);
        }
    };

    useEffect(() => {
        if (restoration.ready || isLoading || !room.currentUserId || room.channel?.id !== channelId) return;
        if (restoreTargetRef.current === undefined) {
            const stored = readChannelViewportAnchor(teamId, channelId, room.currentUserId);
            restoreTargetRef.current =
                targetMessageId && targetMessageAt
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
                channelName={room.channelLabel}
                channelType={room.channel?.type}
                onOpenPins={() => setShowPins(true)}
                onStartHuddle={handleStartHuddle}
                huddleActive={huddleActive}
                huddleReady={huddle.socketReady}
            />
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
                        currentUserId={room.currentUserId}
                        onClose={() => setThreadMessageId(null)}
                        onSendReply={room.sendMessage}
                        onUploadReply={room.sendAttachments}
                        onDelete={room.deleteMessage}
                        isUploading={room.isUploading}
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
