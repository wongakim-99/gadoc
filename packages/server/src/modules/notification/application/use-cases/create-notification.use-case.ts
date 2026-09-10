import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification.port';
import type { NotificationType, NotificationResourceType } from '../../domain/notification.entity';
import { NOTIFICATION_PUBLISHER, type NotificationPublisher } from '../ports/notification-publisher.port';

export interface CreateNotificationInput {
    teamId: string;
    recipientId: string;
    type: NotificationType;
    actorId: string;
    actorName: string;
    content: string;
    resourceType: NotificationResourceType;
    resourceId: string;
    channelId?: string | null;
}

@Injectable()
export class CreateNotificationUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository,
        @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher: NotificationPublisher,
    ) {}

    async execute(input: CreateNotificationInput) {
        // 자기 자신에게는 알림 안 보냄
        if (input.recipientId === input.actorId) return null;
        const notification = await this.repo.save({ ...input, channelId: input.channelId ?? null });
        this.notificationPublisher.emitNotification(notification);
        return notification;
    }

    async executeBulk(inputs: CreateNotificationInput[]) {
        const filtered = inputs.filter((i) => i.recipientId !== i.actorId);
        const notifications = await Promise.all(
            filtered.map((i) => this.repo.save({ ...i, channelId: i.channelId ?? null })),
        );
        notifications.forEach((notification) => this.notificationPublisher.emitNotification(notification));
        return notifications;
    }
}
