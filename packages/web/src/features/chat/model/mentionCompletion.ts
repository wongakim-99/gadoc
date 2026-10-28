import type { TeamMemberSummary } from '@/src/entities/team/types';

export interface MentionCandidate {
    id: string;
    username: string;
    label: string;
    detail: string;
}

export function mentionQueryAt(value: string, position: number) {
    const match = value.slice(0, position).match(/(?:^|[\s([{])@([^\s@]*)$/u);
    return match ? match[1] : null;
}

export function mentionCandidates(members: TeamMemberSummary[], query: string | null): MentionCandidate[] {
    if (query === null || !members.length) return [];
    const normalized = query.toLocaleLowerCase();
    const all: MentionCandidate[] = ['all', 'everyone', 'channel', '전체'].some((word) => word.includes(normalized))
        ? [{ id: 'channel-all', username: 'all', label: '전체', detail: '이 채널에 접근 가능한 멤버' }]
        : [];
    const people = members.flatMap((member) => {
        const username = member.user?.username;
        return username && username.toLocaleLowerCase().includes(normalized)
            ? [{ id: member.userId, username, label: username, detail: member.role }]
            : [];
    });
    return [...people, ...all].slice(0, 8);
}

export function insertMentionAt(value: string, position: number, username: string) {
    const query = mentionQueryAt(value, position);
    if (query === null || !username) return null;
    const start = position - query.length - 1;
    const text = `@${username} `;
    return { value: value.slice(0, start) + text + value.slice(position), position: start + text.length };
}
