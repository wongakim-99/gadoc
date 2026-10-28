'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export interface DraftScope {
    userId: string;
    teamId: string;
    channelId: string;
    threadId?: string;
}

const CHANGE_EVENT = 'slacord:message-draft-change';
const fallback = new Map<string, string>();
const EMPTY = '';

export function messageDraftKey(scope: DraftScope) {
    return `slacord:message-draft:v1:${JSON.stringify([scope.userId, scope.teamId, scope.channelId, scope.threadId ?? null])}`;
}

export function readMessageDraft(key: string): string {
    if (typeof window === 'undefined') return EMPTY;
    if (fallback.has(key)) return fallback.get(key)!;
    try {
        return window.sessionStorage.getItem(key) ?? fallback.get(key) ?? EMPTY;
    } catch {
        return fallback.get(key) ?? EMPTY;
    }
}

export function draftContent(snapshot: string): string {
    try {
        const value = JSON.parse(snapshot);
        return typeof value?.content === 'string' ? value.content : '';
    } catch {
        return '';
    }
}

export function writeMessageDraft(key: string, content: string) {
    // A new revision also protects edits that happen to return to the sent text.
    const snapshot = content ? JSON.stringify({ content, revision: crypto.randomUUID() }) : EMPTY;
    fallback.set(key, snapshot);
    try {
        if (snapshot) window.sessionStorage.setItem(key, snapshot);
        else window.sessionStorage.removeItem(key);
        fallback.delete(key);
    } catch {
        // Navigation within this document still works when storage is unavailable.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSentMessageDraft(key: string, sentSnapshot: string) {
    if (readMessageDraft(key) === sentSnapshot) writeMessageDraft(key, '');
}

function subscribe(listener: () => void) {
    window.addEventListener(CHANGE_EVENT, listener);
    // sessionStorage events reach sibling same-origin split-pane frames.
    window.addEventListener('storage', listener);
    return () => {
        window.removeEventListener(CHANGE_EVENT, listener);
        window.removeEventListener('storage', listener);
    };
}

export function useMessageDraft(scope: DraftScope) {
    const key = messageDraftKey(scope);
    const getSnapshot = useCallback(() => readMessageDraft(key), [key]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
    const content = useMemo(() => draftContent(snapshot), [snapshot]);
    const setContent = useCallback((value: string) => writeMessageDraft(key, value), [key]);
    return { key, snapshot, content, setContent };
}
