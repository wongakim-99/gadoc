export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserIdentity {
    id: string;
    username: string;
    avatarUrl?: string | null;
    profileUpdatedAt?: string;
}

export interface User extends UserIdentity {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string | null;
    createdAt?: string;
}

export interface Presence {
    userId: string;
    status: PresenceStatus;
    lastSeen: string;
}
