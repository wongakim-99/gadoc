import { describe, expect, it } from 'vitest';
import { insertMentionAt, mentionCandidates, mentionQueryAt } from './mentionCompletion';
import type { TeamMemberSummary } from '@/src/entities/team/types';

const members = [
    { userId: 'alice', role: 'member', user: { username: 'Alice' } },
    { userId: 'bob', role: 'member', user: { username: 'Bob' } },
] as TeamMemberSummary[];
describe('mention completion', () => {
    it('detects mentions at a caret without treating an email address as a mention', () => {
        expect(mentionQueryAt('hello @ali tail', 10)).toBe('ali');
        expect(mentionQueryAt('user@example.com', 16)).toBeNull();
        expect(mentionQueryAt('(@한글', 4)).toBe('한글');
    });
    it('preserves the suffix and replaces only the active mention', () => {
        expect(insertMentionAt('hello @ali tail', 10, 'Alice')).toEqual({ value: 'hello @Alice  tail', position: 13 });
        expect(insertMentionAt('no active token', 3, 'Alice')).toBeNull();
    });
    it('supports explicit broadcast without selecting it before people for a blank query', () => {
        expect(mentionCandidates(members, '')[0].username).toBe('Alice');
        expect(mentionCandidates(members, '전체')[0].username).toBe('all');
        expect(mentionCandidates(members, 'ali').map((item) => item.username)).toEqual(['Alice']);
        expect(mentionCandidates([], '')).toEqual([]);
    });
});
