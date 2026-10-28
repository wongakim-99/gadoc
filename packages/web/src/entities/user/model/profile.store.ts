import { create } from 'zustand';
import type { UserIdentity } from '../types';

interface ProfileState {
    profiles: Record<string, UserIdentity>;
    apply: (profiles: UserIdentity[]) => void;
    clear: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
    profiles: {},
    apply: (incoming) =>
        set((state) => {
            const profiles = { ...state.profiles };
            for (const profile of incoming) {
                const previous = profiles[profile.id];
                if (
                    previous?.profileUpdatedAt &&
                    (!profile.profileUpdatedAt || previous.profileUpdatedAt > profile.profileUpdatedAt)
                )
                    continue;
                // Explicit projection prevents an auth/me or member response from caching login emails here.
                profiles[profile.id] = {
                    id: profile.id,
                    username: profile.username,
                    avatarUrl: profile.avatarUrl ?? null,
                    profileUpdatedAt: profile.profileUpdatedAt,
                };
            }
            return { profiles };
        }),
    clear: () => set({ profiles: {} }),
}));

export function useUserIdentity(userId: string, fallbackName = '') {
    const profile = useProfileStore((state) => state.profiles[userId]);
    return profile ?? { id: userId, username: fallbackName, avatarUrl: null };
}
