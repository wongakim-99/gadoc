import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification.port';
import { NOTIFICATION_PUBLISHER, type NotificationPublisher } from '../ports/notification-publisher.port';

@Injectable()
export class MarkNotificationAsReadUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository,
        @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher: NotificationPublisher,
    ) {}

    async execute(id: string, recipientId: string) {
        const notification = await this.repo.markAsRead(id, recipientId);
        if (!notification) {
            throw new BadRequestException('읽음 처리할 알림을 찾을 수 없습니다.');
        }
        this.notificationPublisher.emitNotificationRead(notification.teamId, notification.recipientId, notification.id);
        return notification;
    }
}
