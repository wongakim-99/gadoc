import type { Reaction } from '../../../entities/message/types';
import type { TeamMemberSummary } from '../../../entities/team/types';
import { avatarImageUrl } from '../../../shared/lib/avatar-image';

export function normalizeReactions(reactions: Reaction[]): Reaction[] {
    const groups = new Map<string, Set<string>>();
    for (const reaction of reactions) {
        const users = groups.get(reaction.emoji) ?? new Set<string>();
        for (const id of reaction.userIds) users.add(id);
        groups.set(reaction.emoji, users);
    }
    return [...groups].filter(([, users]) => users.size).map(([emoji, users]) => ({ emoji, userIds: [...users] }));
}

export function reactionPeople(reaction: Reaction, members: TeamMemberSummary[]) {
    return [...new Set(reaction.userIds)].map((id) => {
        const member = members.find((member) => member.userId === id);
        return {
            id,
            name: member?.user?.username?.trim() || '이름을 확인할 수 없는 멤버',
            avatarUrl: reactionAvatarUrl(member?.user?.avatarUrl),
        };
    });
}

export function reactionAvatarUrl(value?: string | null): string | null {
    return avatarImageUrl(value);
}

export function reactionPeopleLabel(reaction: Reaction, members: TeamMemberSummary[]) {
    const people = reactionPeople(reaction, members);
    return `${reaction.emoji} · ${people
        .slice(0, 5)
        .map((person) => person.name)
        .join(', ')}${people.length > 5 ? ` 외 ${people.length - 5}명` : ''}`;
}
