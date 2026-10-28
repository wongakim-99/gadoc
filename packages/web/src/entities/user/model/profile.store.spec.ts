import { beforeEach, describe, expect, it } from 'vitest';
import { useProfileStore } from './profile.store';

describe('profile identity cache', () => {
    beforeEach(() => useProfileStore.getState().clear());
    it('projects only public identity fields, including when seeded from auth/me', () => {
        useProfileStore.getState().apply([
            {
                id: 'user',
                username: '이름',
                avatarUrl: null,
                email: 'private@example.com',
                passwordHash: 'private',
            } as any,
        ]);
        expect(useProfileStore.getState().profiles.user).not.toHaveProperty('email');
        expect(useProfileStore.getState().profiles.user).not.toHaveProperty('passwordHash');
    });
    it('keeps a successful change or deletion when an older workspace request finishes later', () => {
        const profile = {
            id: 'user',
            username: '이름',
            avatarUrl: '/api/old',
            profileUpdatedAt: '2026-01-01T00:00:00.000Z',
        };
        const state = useProfileStore.getState();
        state.apply([profile]);
        state.apply([{ ...profile, avatarUrl: null, profileUpdatedAt: '2026-01-02T00:00:00.000Z' }]);
        state.apply([profile]);
        expect(useProfileStore.getState().profiles.user.avatarUrl).toBeNull();
    });
});
