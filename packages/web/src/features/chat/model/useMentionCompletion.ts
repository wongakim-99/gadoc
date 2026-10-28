'use client';

import { useId, useState, type RefObject, type KeyboardEvent } from 'react';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { insertMentionAt, mentionCandidates, mentionQueryAt } from './mentionCompletion';

export function useMentionCompletion(
    value: string,
    onChange: (value: string) => void,
    textarea: RefObject<HTMLTextAreaElement | null>,
    members: TeamMemberSummary[],
) {
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const mentionListId = useId();
    const candidates = mentionCandidates(members, mentionQuery);
    const index = Math.max(0, Math.min(mentionIndex, candidates.length - 1));
    const detectMention = (next: string, position: number) => {
        setMentionQuery(mentionQueryAt(next, position));
        setMentionIndex(0);
    };
    const insertMention = (username: string) => {
        const element = textarea.current;
        if (!element) return;
        const next = insertMentionAt(value, element.selectionStart, username);
        if (!next) return;
        onChange(next.value);
        setMentionQuery(null);
        requestAnimationFrame(() => {
            element.focus();
            element.setSelectionRange(next.position, next.position);
        });
    };
    const handleMentionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionQuery === null || event.nativeEvent.isComposing) return false;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setMentionQuery(null);
            return true;
        }
        if (!candidates.length) return false;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            setMentionIndex((current) =>
                Math.max(0, Math.min(candidates.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))),
            );
            return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
            event.preventDefault();
            insertMention(candidates[index].username);
            return true;
        }
        return false;
    };
    return {
        mentionQuery,
        mentionIndex: index,
        mentionCandidates: candidates,
        mentionListId,
        detectMention,
        insertMention,
        handleMentionKeyDown,
        setMentionQuery,
        dismissMention: () => setMentionQuery(null),
        onSelect: () => {
            const element = textarea.current;
            if (element && element.selectionStart === element.selectionEnd)
                detectMention(value, element.selectionStart);
        },
    };
}
