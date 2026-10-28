import { describe, expect, it } from 'vitest';
import { normalizeReactions, reactionAvatarUrl, reactionPeople, reactionPeopleLabel } from './reactionPeople';
import type { TeamMemberSummary } from '../../../entities/team/types';

const members = [
    { userId: 'member', user: { username: '현재 이름', avatarUrl: '/api/files?key=gadoc/avatar.png' } },
    { userId: 'deleted', user: null },
] as TeamMemberSummary[];

describe('reaction participants', () => {
    it('combines legacy duplicate emoji and participant entries without a database rewrite', () => {
        expect(
            normalizeReactions([
                { emoji: '👍', userIds: ['a', 'a'] },
                { emoji: '🎉', userIds: [] },
                { emoji: '👍', userIds: ['b', 'a'] },
            ]),
        ).toEqual([{ emoji: '👍', userIds: ['a', 'b'] }]);
    });
    it('uses current authorized names, deduplicates participants and never displays internal IDs', () => {
        const reaction = { emoji: '👍', userIds: ['member', 'member', 'left-secret-id', 'deleted'] };
        const people = reactionPeople(reaction, members);
        expect(people).toHaveLength(3);
        expect(people[0].name).toBe('현재 이름');
        expect(people[1].name).toBe('이름을 확인할 수 없는 멤버');
        expect(reactionPeopleLabel(reaction, members)).not.toContain('secret-id');
        expect(reactionPeople({ emoji: '👍', userIds: [] }, members)).toEqual([]);
    });
    it('bounds hover summaries and only uses the private authenticated image route', () => {
        const reaction = { emoji: '👍', userIds: ['1', '2', '3', '4', '5', '6', '7'] };
        expect(reactionPeopleLabel(reaction, [])).toContain('외 2명');
        expect(reactionAvatarUrl('/api/files?key=gadoc/avatar.png')).toBe('/api/files?key=gadoc/avatar.png');
        expect(reactionAvatarUrl('https://bucket.kscold.com/gadoc/gadoc/avatar.png')).toBe(
            '/api/files?key=gadoc/avatar.png',
        );
        for (const url of [
            'https://tracker.example/avatar',
            '//tracker.example/a',
            'javascript:test',
            'data:image/svg+xml,test',
        ])
            expect(reactionAvatarUrl(url)).toBeNull();
    });
});
