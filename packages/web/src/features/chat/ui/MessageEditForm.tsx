'use client';

import type { RefObject } from 'react';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { useMentionCompletion } from '../model/useMentionCompletion';
import { MentionSuggestions } from './MentionSuggestions';

interface Props {
    editRef: RefObject<HTMLTextAreaElement | null>;
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    members: TeamMemberSummary[];
}

export function MessageEditForm({ editRef, value, onChange, onKeyDown, members }: Props) {
    const mentions = useMentionCompletion(value, onChange, editRef, members);
    return (
        <div className="relative mt-1">
            {mentions.mentionQuery !== null && mentions.mentionCandidates.length > 0 && (
                <MentionSuggestions
                    anchorRef={editRef}
                    id={mentions.mentionListId}
                    activeIndex={mentions.mentionIndex}
                    members={mentions.mentionCandidates}
                    onSelect={mentions.insertMention}
                />
            )}
            <textarea
                ref={editRef}
                value={value}
                aria-label="메시지 수정"
                aria-autocomplete="list"
                aria-controls={mentions.mentionCandidates.length ? mentions.mentionListId : undefined}
                aria-activedescendant={
                    mentions.mentionCandidates.length ? `${mentions.mentionListId}-${mentions.mentionIndex}` : undefined
                }
                onChange={(event) => {
                    onChange(event.target.value);
                    mentions.detectMention(event.target.value, event.target.selectionStart);
                }}
                onKeyDown={(event) => {
                    if (!mentions.handleMentionKeyDown(event)) onKeyDown(event);
                }}
                onSelect={mentions.onSelect}
                onBlur={mentions.dismissMention}
                className="w-full resize-none rounded-control border border-border-primary bg-bg-secondary px-3 py-2 text-[15px] leading-[22px] text-white outline-none focus:border-action-text"
                rows={Math.min(value.split('\n').length + 1, 6)}
            />
            <p className="mt-1 text-[11px] text-text-tertiary">Enter로 저장 · Esc로 취소 · Shift+Enter로 줄바꿈</p>
        </div>
    );
}
