import type { NotificationEntity } from '../../domain/notification.entity';

/** Outbound notifications; application use cases do not depend on Socket.IO. */
export interface NotificationPublisher {
    emitNotification(notification: NotificationEntity): void;
    emitNotificationRead(teamId: string, userId: string, notificationId: string): void;
    emitNotificationsReadAll(teamId: string, userId: string): void;
}

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');
