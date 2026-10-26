'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { documentApi, unwrapApiData } from '@/lib/api-client';
import type { DocumentFull } from '@/src/entities/document/types';
import { DocumentSaveQueue, type DocumentDraft, type SaveStatus } from './DocumentSaveQueue';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';

export function useDocumentAutosave(doc: DocumentFull) {
    const router = useRouter();
    const [title, setTitle] = useState(doc.title);
    const [status, setStatus] = useState<SaveStatus>('saved');
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(doc.updatedAt);
    const queue = useRef<DocumentSaveQueue | null>(null);
    const draft = useRef<DocumentDraft>({ title: doc.title, content: doc.content });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const composing = useRef(false);
    const mounted = useRef(true);

    const flush = useCallback(async () => {
        if (timer.current) clearTimeout(timer.current);
        return queue.current ? queue.current.flush() : false;
    }, []);
    useWorkspaceLeaveGuard(() => (queue.current ? flush() : true));

    const schedule = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        if (!composing.current) timer.current = setTimeout(() => void flush(), 700);
    }, [flush]);

    const onReady = useCallback(
        (normalized: string) => {
            if (queue.current || doc.canEdit === false) return;
            draft.current.content = normalized;
            queue.current = new DocumentSaveQueue(
                { title: doc.title, content: normalized },
                async (snapshot) => {
                    const response = await documentApi.updateDocument(doc.teamId, doc.id, {
                        title: snapshot.title.trim() || '제목 없음',
                        content: snapshot.content,
                        contentFormat: 'json',
                    });
                    const saved = unwrapApiData<DocumentFull>(response);
                    if (!response.success || !saved)
                        throw new Error('자동 저장에 실패했습니다. 작성 내용은 유지됩니다.');
                    if (mounted.current) setUpdatedAt(saved.updatedAt);
                    window.dispatchEvent(new CustomEvent('slacord:document-updated', { detail: saved }));
                },
                (next, message) => {
                    if (!mounted.current) return;
                    setStatus(next);
                    setError(message ?? '');
                },
            );
            queue.current.update(draft.current);
            schedule();
        },
        [doc, schedule],
    );

    const changeTitle = (value: string) => {
        setTitle(value);
        draft.current = { ...draft.current, title: value };
        queue.current?.update(draft.current);
        schedule();
    };
    const changeContent = (value: string) => {
        draft.current = { ...draft.current, content: value };
        queue.current?.update(draft.current);
        schedule();
    };
    const setComposing = (value: boolean) => {
        composing.current = value;
        queue.current?.pause(value);
        if (value && timer.current) clearTimeout(timer.current);
        if (!value) schedule();
    };

    useEffect(() => {
        mounted.current = true;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!queue.current?.dirty && !queue.current?.busy) return;
            void flush();
            event.preventDefault();
            event.returnValue = '';
        };
        const onLinkClick = (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            if (!queue.current?.dirty && !queue.current?.busy) return;
            const anchor = event.target instanceof Element ? event.target.closest('a') : null;
            if (
                !anchor ||
                anchor.target === '_blank' ||
                anchor.hasAttribute('download') ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const url = new URL(anchor.href);
            if (url.origin !== location.origin || url.href === location.href) return;
            event.preventDefault();
            event.stopPropagation();
            void flush().then((saved) => {
                if (saved && mounted.current) router.push(url.pathname + url.search + url.hash);
            });
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void flush();
            }
        };
        const online = () => void flush();
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('online', online);
        document.addEventListener('click', onLinkClick, true);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            mounted.current = false;
            if (timer.current) clearTimeout(timer.current);
            // Route changes and browser Back may unmount without a link click.
            void queue.current?.flush();
            window.removeEventListener('beforeunload', beforeUnload);
            window.removeEventListener('online', online);
            document.removeEventListener('click', onLinkClick, true);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [flush, router]);

    return { title, status, error, updatedAt, onReady, changeTitle, changeContent, setComposing, flush };
}
