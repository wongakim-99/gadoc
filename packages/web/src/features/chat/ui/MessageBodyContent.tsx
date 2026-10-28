import { ReactionBar } from './ReactionBar';
import { MessageAttachments } from './MessageAttachments';
import { MessageEditForm } from './MessageEditForm';
import type { Message } from '@/src/entities/message/types';
import { ConnectedText } from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import type { TeamMemberSummary } from '@/src/entities/team/types';

interface Props {
    currentUserId: string;
    editRef: React.RefObject<HTMLTextAreaElement | null>;
    editing: boolean;
    editValue: string;
    message: Message;
    onChangeEdit: (value: string) => void;
    onEditKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onOpenThread?: (message: Message) => void;
    onReact: (emoji: string) => void;
    members: TeamMemberSummary[];
}

export function MessageBodyContent({
    currentUserId,
    editRef,
    editing,
    editValue,
    message,
    onChangeEdit,
    onEditKeyDown,
    onOpenThread,
    onReact,
    members,
}: Props) {
    const replyCount = message.replyCount ?? 0;

    return (
        <>
            {editing ? (
                <MessageEditForm
                    members={members}
                    editRef={editRef}
                    onChange={onChangeEdit}
                    onKeyDown={onEditKeyDown}
                    value={editValue}
                />
            ) : message.content ? (
                <p className="break-words whitespace-pre-wrap text-[15px] leading-[22px] text-white/90">
                    <ConnectedText text={message.content} />
                </p>
            ) : null}
            <MessageAttachments attachments={message.attachments} />
            {message.reactions.length > 0 ? (
                <div className="mt-1">
                    <ReactionBar reactions={message.reactions} currentUserId={currentUserId} onToggle={onReact} />
                </div>
            ) : null}
            {!message.replyToId && replyCount > 0 && onOpenThread ? (
                <button
                    onClick={() => onOpenThread(message)}
                    className="mt-0.5 flex items-center gap-1 text-[13px] text-info hover:underline"
                >
                    {replyCount}개의 답글
                </button>
            ) : null}
        </>
    );
}
