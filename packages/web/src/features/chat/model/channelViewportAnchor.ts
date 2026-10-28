'use client';

export interface ChannelViewportAnchor {
    createdAt: string;
    messageId: string;
    offset?: number;
    atBottom?: boolean;
}

const STORAGE_PREFIX = 'slacord:channel-viewport-anchor';

function getStorageKey(teamId: string, channelId: string, userId: string) {
    return `${STORAGE_PREFIX}:v2:${JSON.stringify([userId, teamId, channelId])}`;
}

export function readChannelViewportAnchor(
    teamId: string,
    channelId: string,
    userId = '',
): ChannelViewportAnchor | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(getStorageKey(teamId, channelId, userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ChannelViewportAnchor>;
        if (typeof parsed?.messageId !== 'string' || typeof parsed.createdAt !== 'string') return null;
        return {
            messageId: parsed.messageId,
            createdAt: parsed.createdAt,
            ...(typeof parsed.offset === 'number' && Number.isFinite(parsed.offset) ? { offset: parsed.offset } : {}),
            ...(typeof parsed.atBottom === 'boolean' ? { atBottom: parsed.atBottom } : {}),
        };
    } catch {
        return null;
    }
}

export function writeChannelViewportAnchor(
    teamId: string,
    channelId: string,
    anchor: ChannelViewportAnchor | null,
    userId = '',
) {
    if (typeof window === 'undefined') return;

    const storageKey = getStorageKey(teamId, channelId, userId);
    try {
        if (!anchor) window.sessionStorage.removeItem(storageKey);
        else window.sessionStorage.setItem(storageKey, JSON.stringify(anchor));
    } catch {
        // Storage may be disabled or full; scrolling must remain usable.
    }
}
