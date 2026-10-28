import { Inject, Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMessageRepository } from '../../domain/message.port';
import { MESSAGE_REPOSITORY } from '../../domain/message.port';
import { MessageEntity } from '../../domain/message.entity';
import { MessageMentionsService } from '../services/message-mentions.service';
import { NOTIFICATION_EVENTS, type MentionedEvent } from '../../../../shared/events/notification-events';

/** 메시지 편집 유스케이스 - 작성자 본인만 가능 */
@Injectable()
export class EditMessageUseCase {
    constructor(
        @Inject(MESSAGE_REPOSITORY) private readonly messageRepo: IMessageRepository,
        private readonly mentions: MessageMentionsService,
        private readonly events: EventEmitter2,
    ) {}

    async execute(messageId: string, userId: string, content: string): Promise<MessageEntity> {
        const message = await this.messageRepo.findById(messageId);
        if (!message) throw new BadRequestException('존재하지 않는 메시지입니다.');
        if (message.authorId !== userId) throw new BadRequestException('메시지 작성자만 편집할 수 있습니다.');
        if (message.type === 'system') throw new BadRequestException('시스템 메시지는 편집할 수 없습니다.');

        const normalized = content.trim();
        if (!normalized) throw new BadRequestException('메시지 내용을 입력해 주세요.');
        const mentions = await this.mentions.resolve(message.teamId, message.channelId, userId, normalized);
        if (normalized === message.content) return message;
        const updated = await this.messageRepo.updateContent(messageId, normalized, {
            mentions,
            expectedContent: message.content,
        });
        if (!updated) throw new ConflictException('메시지가 변경됐습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.');
        const added = mentions.filter((id) => !message.mentions.includes(id));
        if (added.length) {
            const event: MentionedEvent = {
                teamId: message.teamId,
                channelId: message.channelId,
                recipientIds: added,
                actorId: userId,
                actorName: message.authorName ?? '알 수 없음',
                content: normalized,
                resourceType: 'message',
                resourceId: message.id,
            };
            this.events.emit(NOTIFICATION_EVENTS.MENTIONED, event);
        }
        return updated;
    }
}
