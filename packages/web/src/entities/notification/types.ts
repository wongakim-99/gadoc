export type NotificationType = 'mention' | 'document_assigned' | 'issue_assigned' | 'issue_updated' | 'thread_reply';
export type NotificationMode = 'all' | 'mentions' | 'off';
export type NotificationKind = 'mention' | 'thread' | 'issue' | 'document' | 'chat' | 'update';
export interface NotificationPreference {
    mode: NotificationMode;
    channelModes: Record<string, NotificationMode>;
    kinds: Record<NotificationKind, boolean>;
    channelKinds: Record<string, Partial<Record<NotificationKind, boolean>>>;
    revision: number;
}

export interface UpdateNotificationPreference {
    revision: number;
    channelId?: string;
    mode?: NotificationMode | 'inherit';
    kinds?: Partial<Record<NotificationKind, boolean | 'inherit'>>;
    reset?: boolean;
}

export interface AppNotification {
    id: string;
    teamId: string;
    recipientId: string;
    type: NotificationType;
    actorId: string;
    actorName: string;
    content: string;
    resourceType: 'message' | 'issue' | 'document';
    resourceId: string;
    channelId: string | null;
    isRead: boolean;
    createdAt: string;
}
