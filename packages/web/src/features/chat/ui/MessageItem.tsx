'use client';

import { MessageActionBar } from './MessageActionBar';
import { useState } from 'react';
import { MessageWorkPanel } from '@/src/features/issue/ui/MessageWorkPanel';
import { MessageAuthorMeta } from './MessageAuthorMeta';
import { MessageActionToggle } from './MessageActionToggle';
import { MessageBodyContent } from './MessageBodyContent';
import { SystemMessageItem } from './SystemMessageItem';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import type { Message } from '@/src/entities/message/types';
import { useMessageActionMenu } from '../model/useMessageActionMenu';
import { useMessageItemEditor } from '../model/useMessageItemEditor';

interface Props {
    idPrefix?: string;
    highlighted?: boolean;
    message: Message;
    currentUserId: string;
    onReact: (messageId: string, emoji: string) => void;
    onDelete?: (messageId: string) => void;
    onEdit?: (messageId: string, content: string) => Promise<void>;
    onOpenThread?: (message: Message) => void;
    onTogglePin?: (message: Message) => Promise<unknown>;
}

export function MessageItem({
    idPrefix = 'message',
    highlighted = false,
    message,
    currentUserId,
    onReact,
    onDelete,
    onEdit,
    onOpenThread,
    onTogglePin,
}: Props) {
    const time = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const isOwn = message.authorId === currentUserId;
    const [workOpen, setWorkOpen] = useState(false);
    const [actionError, setActionError] = useState('');
    const runAction = async (action: () => unknown) => {
        setActionError('');
        try {
            await action();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '변경하지 못했습니다. 다시 시도해 주세요.');
        }
    };
    const authorLabel = message.authorName || message.authorId.slice(-6);
    const { cancelEdit, editContent, editRef, editing, setEditContent, setEditing, startEdit } = useMessageItemEditor(
        message.content,
    );
    const { closeMenu, containerRef, open, openMenu, supportsHover, toggleMenu } = useMessageActionMenu();

    const saveEdit = async () => {
        const trimmed = editContent.trim();
        if (!trimmed || trimmed === message.content || !onEdit) return;
        await runAction(async () => {
            await onEdit(message.id, trimmed);
            setEditing(false);
        });
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            cancelEdit();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void saveEdit();
        }
    };

    if (message.type === 'system') return <SystemMessageItem message={message} />;

    return (
        <div
            id={`${idPrefix}-${message.id}`}
            data-message-created-at={message.createdAt}
            data-message-id={message.id}
            ref={containerRef}
            tabIndex={0}
            onFocusCapture={openMenu}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
            }}
            onMouseEnter={supportsHover ? openMenu : undefined}
            onMouseLeave={supportsHover ? closeMenu : undefined}
            className={`relative flex items-start gap-3 px-5 py-1.5 transition-colors ${highlighted ? "bg-brand-500/5 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-400/40 before:content-['']" : editing ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}`}
        >
            <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0 select-none"
                style={{ backgroundColor: getAvatarColor(message.authorId) }}
            >
                {authorLabel.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1 pt-[1px]">
                <MessageAuthorMeta
                    authorLabel={authorLabel}
                    time={time}
                    isEdited={message.isEdited}
                    isPinned={message.isPinned}
                />
                <MessageBodyContent
                    currentUserId={currentUserId}
                    editRef={editRef}
                    editing={editing}
                    editValue={editContent}
                    message={message}
                    onChangeEdit={setEditContent}
                    onEditKeyDown={handleEditKeyDown}
                    onOpenThread={onOpenThread}
                    onReact={(emoji) => onReact(message.id, emoji)}
                />
                {workOpen && <MessageWorkPanel message={message} />}
                {actionError && (
                    <p role="alert" className="mt-1 text-xs text-error">
                        {actionError}
                    </p>
                )}
            </div>
            <div className="shrink-0 pt-1 sm:hidden">
                <MessageActionToggle onClick={toggleMenu} />
            </div>

            {!editing ? (
                <MessageActionBar
                    isOwn={isOwn}
                    message={message}
                    onDelete={onDelete ? (id) => void runAction(() => onDelete(id)) : undefined}
                    onEdit={
                        onEdit
                            ? () => {
                                  startEdit();
                                  closeMenu();
                              }
                            : undefined
                    }
                    onOpenThread={onOpenThread && !message.replyToId ? () => onOpenThread(message) : undefined}
                    onReact={(emoji) => onReact(message.id, emoji)}
                    onTogglePin={onTogglePin ? () => void runAction(() => onTogglePin(message)) : undefined}
                    visible={open}
                    onRelatedWork={() => setWorkOpen((value) => !value)}
                />
            ) : null}
        </div>
    );
}
