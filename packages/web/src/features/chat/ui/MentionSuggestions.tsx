'use client';

import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import type { TeamMemberSummary } from '@/src/entities/team/types';

interface Props {
    activeIndex: number;
    members: TeamMemberSummary[];
    onSelect: (username: string) => void;
}

export function MentionSuggestions({ activeIndex, members, onSelect }: Props) {
    return (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-48 overflow-y-auto rounded-lg border border-border-primary bg-bg-secondary shadow-xl">
            {members.map((member, index) => {
                const name = member.user?.username ?? member.userId;
                return (
                    <button
                        key={member.userId}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            onSelect(name);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${index === activeIndex ? 'bg-white/8 text-white' : 'text-text-secondary hover:bg-white/5'}`}
                    >
                        <UserAvatar userId={member.userId} name={name} size={24} className="h-6 w-6 shrink-0 rounded-full text-[10px] font-bold text-white flex items-center justify-center" />
                        <span className="font-medium">{name}</span>
                        <span className="ml-auto text-[11px] text-text-tertiary">{member.role}</span>
                    </button>
                );
            })}
        </div>
    );
}
