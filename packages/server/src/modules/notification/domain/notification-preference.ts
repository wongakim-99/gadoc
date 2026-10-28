export type NotificationMode = 'all' | 'mentions' | 'off';
export const NOTIFICATION_KINDS = ['mention', 'thread', 'issue', 'document', 'chat', 'update'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationKinds = Record<NotificationKind, boolean>;
export type NotificationKindOverrides = Partial<NotificationKinds>;
export const DEFAULT_NOTIFICATION_KINDS: NotificationKinds = {
    mention: true,
    thread: true,
    issue: true,
    document: true,
    chat: true,
    update: true,
};

export interface NotificationPreferenceValue {
    mode: NotificationMode;
    channelModes: Record<string, NotificationMode>;
    kinds: NotificationKinds;
    channelKinds: Record<string, NotificationKindOverrides>;
    revision: number;
}

export interface UpdateNotificationPreference {
    revision: number;
    channelId?: string;
    mode?: NotificationMode | 'inherit';
    kinds?: Partial<Record<NotificationKind, boolean | 'inherit'>>;
    reset?: boolean;
}

export function notificationModeFor(value: NotificationPreferenceValue, channelId?: string | null): NotificationMode {
    return (channelId && value.channelModes[channelId]) || value.mode;
}

export function notificationAllowed(mode: NotificationMode, related: boolean) {
    return mode === 'all' || (mode === 'mentions' && related);
}

export function notificationKindEnabled(
    value: NotificationPreferenceValue,
    kind: NotificationKind,
    channelId?: string | null,
): boolean {
    return (channelId ? value.channelKinds[channelId]?.[kind] : undefined) ?? value.kinds[kind];
}

export function channelVisibleForNotifications(
    channel: { teamId: string; type: string; isArchived: boolean; isMember(userId: string): boolean },
    teamId: string,
    userId: string,
) {
    return (
        channel.teamId === teamId &&
        !channel.isArchived &&
        (channel.type === 'public' || channel.type === 'voice' || channel.isMember(userId))
    );
}
