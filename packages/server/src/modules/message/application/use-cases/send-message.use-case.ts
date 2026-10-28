import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMessageRepository } from '../../domain/message.port';
import { MESSAGE_REPOSITORY } from '../../domain/message.port';
import { Attachment, MessageEntity, MessageType } from '../../domain/message.entity';
import { MessageMentionsService } from '../services/message-mentions.service';
import {
    NOTIFICATION_EVENTS,
    type MentionedEvent,
    type ThreadRepliedEvent,
} from '../../../../shared/events/notification-events';

export interface SendMessageInput {
    teamId: string;
    channelId: string;
    authorId: string;
    authorName: string | null;
    content?: string;
    type?: MessageType;
    attachments?: Attachment[];
    replyToId?: string;
}

/**
 * 메시지 전송 유스케이스.
 * 알림은 도메인 이벤트로 발행하고 NotificationEventListener가 처리.
 */
@Injectable()
export class SendMessageUseCase {
    constructor(
        @Inject(MESSAGE_REPOSITORY) private readonly messageRepo: IMessageRepository,
        private readonly mentions: MessageMentionsService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async execute(input: SendMessageInput): Promise<MessageEntity> {
        const content = input.content?.trim() ?? '';
        const attachments = input.attachments ?? [];
        const type = attachments.length > 0 ? 'file' : (input.type ?? 'text');
        const mentionUserIds = await this.mentions.resolve(input.teamId, input.channelId, input.authorId, content);
        const parent = input.replyToId ? await this.messageRepo.findById(input.replyToId) : null;
        if (input.replyToId && (!parent || parent.teamId !== input.teamId || parent.channelId !== input.channelId))
            throw new BadRequestException('같은 채널의 메시지에만 답글을 작성할 수 있습니다.');

        const message = await this.messageRepo.save({
            teamId: input.teamId,
            channelId: input.channelId,
            authorId: input.authorId,
            authorName: input.authorName,
            content: content || attachments.map((attachment) => attachment.name).join(', '),
            type,
            attachments,
            replyToId: input.replyToId ?? null,
            mentions: mentionUserIds,
        });

        if (mentionUserIds.length > 0) {
            const event: MentionedEvent = {
                teamId: input.teamId,
                recipientIds: mentionUserIds,
                actorId: input.authorId,
                actorName: input.authorName ?? '알 수 없음',
                content,
                resourceType: 'message',
                resourceId: message.id,
                channelId: input.channelId,
            };
            this.eventEmitter.emit(NOTIFICATION_EVENTS.MENTIONED, event);
        }

        if (input.replyToId) {
            if (parent && parent.authorId !== input.authorId && !mentionUserIds.includes(parent.authorId)) {
                const event: ThreadRepliedEvent = {
                    teamId: input.teamId,
                    recipientId: parent.authorId,
                    actorId: input.authorId,
                    actorName: input.authorName ?? '알 수 없음',
                    content,
                    resourceType: 'message',
                    resourceId: message.id,
                    channelId: input.channelId,
                };
                this.eventEmitter.emit(NOTIFICATION_EVENTS.THREAD_REPLIED, event);
            }
        }

        return message;
    }

}
