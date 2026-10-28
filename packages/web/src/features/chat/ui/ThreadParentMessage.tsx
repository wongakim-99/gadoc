import { useUserIdentity } from '@/src/entities/user/model/profile.store';
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import type { Message } from '@/src/entities/message/types';
import { MessageAttachments } from './MessageAttachments';

interface Props {
    message: Message;
}

export function ThreadParentMessage({ message }: Props) {
    const author = useUserIdentity(message.authorId, message.authorName || message.authorId.slice(-6)).username;
    const time = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="flex gap-2.5 px-4 pt-4">
            <UserAvatar userId={message.authorId} name={author} size={36} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold text-white">{author}</span>
                    <span className="text-[11px] text-text-tertiary">{time}</span>
                </div>
                {message.content ? <p className="mt-0.5 break-words whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">{message.content}</p> : null}
                <MessageAttachments attachments={message.attachments} />
            </div>
        </div>
    );
}
