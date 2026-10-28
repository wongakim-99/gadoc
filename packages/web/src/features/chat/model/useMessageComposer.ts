'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { clearSentMessageDraft, useMessageDraft, type DraftScope } from './messageDraft';

interface Props {
    draftScope: DraftScope;
    members: TeamMemberSummary[];
    onTyping: () => void;
    onUpload: (files: File[], content: string) => Promise<void>;
    onSend: (content: string) => void | Promise<void>;
}

function hasFilesTransfer(dataTransfer: DataTransfer | null) {
    if (!dataTransfer) return false;
    return Array.from(dataTransfer.types ?? []).includes('Files');
}

export function useMessageComposer({ draftScope, members, onTyping, onUpload, onSend }: Props) {
    const { content, setContent, key: draftKey, snapshot } = useMessageDraft(draftScope);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragDepthRef = useRef(0);
    const sendingRef = useRef(false);
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const autoResize = useCallback(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    }, []);

    useEffect(() => {
        autoResize();
    }, [autoResize, content]);

    const mentionCandidates = useMemo(() => {
        if (mentionQuery === null || members.length === 0) return [];
        const query = mentionQuery.toLowerCase();
        return members.filter((member) => (member.user?.username?.toLowerCase() ?? '').includes(query)).slice(0, 6);
    }, [members, mentionQuery]);

    const detectMention = (value: string, cursorPosition: number) => {
        const before = value.slice(0, cursorPosition);
        const match = before.match(/@(\S*)$/);
        setMentionQuery(match ? match[1] : null);
        if (match) setMentionIndex(0);
    };

    const insertMention = (username: string) => {
        const element = textareaRef.current;
        if (!element) return;
        const position = element.selectionStart;
        const before = content.slice(0, position);
        const after = content.slice(position);
        const atIndex = before.lastIndexOf('@');
        const nextContent = `${before.slice(0, atIndex)}@${username} ${after}`;
        setContent(nextContent);
        setMentionQuery(null);
        setTimeout(() => {
            element.focus();
            const nextPosition = atIndex + username.length + 2;
            element.selectionStart = nextPosition;
            element.selectionEnd = nextPosition;
        }, 0);
    };

    const handleChange = useCallback(
        (value: string, cursorPosition: number) => {
            setContent(value);
            detectMention(value, cursorPosition);
            onTyping();
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {}, 2000);
        },
        [onTyping, setContent],
    );

    const submit = async () => {
        const trimmed = content.trim();
        if (sendingRef.current || (!trimmed && pendingFiles.length === 0)) return;
        sendingRef.current = true;
        setIsSending(true);
        setSendError(null);
        try {
            if (pendingFiles.length > 0) {
                await onUpload(pendingFiles, trimmed);
                setPendingFiles((current) => current.filter((file) => !pendingFiles.includes(file)));
            } else {
                await onSend(trimmed);
            }
            clearSentMessageDraft(draftKey, snapshot);
            setMentionQuery(null);
        } catch {
            setSendError('메시지를 전송하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도해 주세요.');
        } finally {
            sendingRef.current = false;
            setIsSending(false);
        }
    };

    const appendFiles = useCallback((nextFiles: File[]) => {
        if (nextFiles.length === 0) return;
        setPendingFiles((current) => [...current, ...nextFiles]);
    }, []);

    const removePendingFile = useCallback((index: number) => {
        setPendingFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    }, []);

    const handlePaste = useCallback(
        (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const files = Array.from(event.clipboardData.files ?? []);
            if (!files.length) return;
            // Keep native text insertion when the clipboard also contains text.
            if (!event.clipboardData.getData('text/plain')) event.preventDefault();
            appendFiles(files);
        },
        [appendFiles],
    );

    const handleFileChange = async (files: FileList | null) => {
        const nextFiles = Array.from(files ?? []);
        if (nextFiles.length === 0) return;
        appendFiles(nextFiles);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
        if (!hasFilesTransfer(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingFiles(true);
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
        if (!hasFilesTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
        if (!hasFilesTransfer(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingFiles(false);
        }
    }, []);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!hasFilesTransfer(event.dataTransfer)) return;
            event.preventDefault();
            dragDepthRef.current = 0;
            setIsDraggingFiles(false);
            appendFiles(Array.from(event.dataTransfer.files ?? []));
        },
        [appendFiles],
    );

    return {
        content,
        fileInputRef,
        handleChange,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileChange,
        handlePaste,
        isDraggingFiles,
        isSending,
        sendError,
        insertMention,
        mentionCandidates,
        mentionIndex,
        mentionQuery,
        pendingFiles,
        removePendingFile,
        setMentionIndex,
        setMentionQuery,
        setContent,
        submit,
        textareaRef,
    };
}
