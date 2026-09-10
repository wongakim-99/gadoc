import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification.port';
import { NOTIFICATION_PUBLISHER, type NotificationPublisher } from '../ports/notification-publisher.port';

@Injectable()
export class MarkAllNotificationsAsReadUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository,
        @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher: NotificationPublisher,
    ) {}

    async execute(teamId: string, recipientId: string) {
        const updatedCount = await this.repo.markAllAsRead(teamId, recipientId);
        if (updatedCount > 0) {
            this.notificationPublisher.emitNotificationsReadAll(teamId, recipientId);
        }
        return updatedCount;
    }
}
