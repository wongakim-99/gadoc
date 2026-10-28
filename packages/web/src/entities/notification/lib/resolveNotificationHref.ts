import type { AppNotification } from '../types';

export function resolveNotificationHref(teamId: string, notification: AppNotification) {
    if (notification.resourceType === 'issue') {
        return `/${teamId}/issues?issue=${notification.resourceId}`;
    }

    if (notification.resourceType === 'document') {
        return `/${teamId}/docs/${notification.resourceId}`;
    }

    if (notification.channelId) {
        const query =
            notification.resourceType === 'message' ? `?message=${encodeURIComponent(notification.resourceId)}` : '';
        return `/${teamId}/channel/${notification.channelId}${query}`;
    }

    return `/${teamId}`;
}
