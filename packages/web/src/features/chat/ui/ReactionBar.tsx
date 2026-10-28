'use client';

import { useRef, useState } from 'react';
import type { Reaction } from '@/src/entities/message/types';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { SmilePlus, UsersRound } from 'lucide-react';
import { useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { useTeamMemberSnapshot } from '@/src/features/team/model/useTeamWorkspaceData';
import { ReactionPeopleDialog } from './ReactionPeopleDialog';
import { normalizeReactions, reactionPeopleLabel } from '../model/reactionPeople';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];

interface Props {
    reactions: Reaction[];
    currentUserId: string;
    onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onToggle }: Props) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerAnchor = useRef<HTMLButtonElement>(null);
    const [showPeople, setShowPeople] = useState(false);
    const connection = useWorkspaceConnection();
    const teamId = connection?.teamId ?? '';
    const members = useTeamMemberSnapshot(teamId);
    const visibleReactions = normalizeReactions(reactions);

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {visibleReactions.map((r) => {
                const reacted = r.userIds.includes(currentUserId);
                return (
                    <button
                        key={r.emoji}
                        type="button"
                        aria-pressed={reacted}
                        title={reactionPeopleLabel(r, members)}
                        onClick={() => onToggle(r.emoji)}
                        className={`flex min-h-7 items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            reacted
                                ? 'bg-slack-green/20 border-slack-green/40 text-slack-green'
                                : 'bg-bg-tertiary border-border-primary text-text-secondary hover:border-slack-green/40'
                        }`}
                    >
                        <span>{r.emoji}</span>
                        <span>{new Set(r.userIds).size}</span>
                    </button>
                );
            })}
            <div className="relative">
                <button
                    ref={pickerAnchor}
                    type="button"
                    aria-label="리액션 추가"
                    title="리액션 추가"
                    aria-haspopup="dialog"
                    aria-expanded={showPicker}
                    onClick={() => setShowPicker((prev) => !prev)}
                    className={`flex h-7 w-8 items-center justify-center rounded-full border transition-colors ${showPicker ? 'border-border-primary bg-bg-hover text-text-primary' : 'border-transparent text-text-tertiary hover:border-border-primary hover:bg-bg-hover hover:text-text-secondary'}`}
                >
                    <SmilePlus size={16} strokeWidth={1.6} />
                </button>
                <EmojiPickerPopover
                    align="left"
                    anchorRef={pickerAnchor}
                    emojis={QUICK_EMOJIS}
                    onClose={() => setShowPicker(false)}
                    onSelect={onToggle}
                    open={showPicker}
                />
            </div>
            {teamId && (
                <button
                    type="button"
                    aria-label="리액션 참여자 보기"
                    title="누가 반응했는지 보기"
                    onClick={() => setShowPeople(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                >
                    <UsersRound size={13} />
                </button>
            )}
            {showPeople && teamId && (
                <ReactionPeopleDialog
                    reactions={visibleReactions}
                    currentUserId={currentUserId}
                    teamId={teamId}
                    onClose={() => setShowPeople(false)}
                />
            )}
        </div>
    );
}
