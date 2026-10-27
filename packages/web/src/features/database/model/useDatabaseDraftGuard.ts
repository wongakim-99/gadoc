'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { canLeaveWorkspacePane, useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';

type Draft = { dirty: () => boolean; flush: () => boolean | Promise<boolean> };
const drafts = new Set<{ current: Draft }>();
let detach: (() => void) | null = null;

/** One set of DOM listeners per frame, regardless of the number of visible cells. */
export function useDatabaseDraftGuard(dirty: () => boolean, flush: () => boolean | Promise<boolean>) {
    const router = useRouter();
    const current = useRef({ dirty, flush });
    current.current = { dirty, flush };
    useWorkspaceLeaveGuard(flush);
    useEffect(() => {
        drafts.add(current);
        if (!detach) {
            const isDirty = () => [...drafts].some((item) => item.current.dirty());
            const beforeUnload = (event: BeforeUnloadEvent) => {
                if (!isDirty()) return;
                event.preventDefault();
                event.returnValue = '';
            };
            const click = (event: MouseEvent) => {
                if (
                    event.defaultPrevented ||
                    !isDirty() ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                )
                    return;
                const anchor = event.target instanceof Element ? event.target.closest('a') : null;
                if (
                    !anchor ||
                    anchor.target === '_blank' ||
                    anchor.hasAttribute('download') ||
                    anchor.hasAttribute('data-manages-draft-navigation')
                )
                    return;
                const url = new URL(anchor.href);
                if (url.origin !== location.origin || url.href === location.href) return;
                event.preventDefault();
                event.stopPropagation();
                void canLeaveWorkspacePane().then((saved) => {
                    if (saved && drafts.size) router.push(url.pathname + url.search + url.hash);
                });
            };
            window.addEventListener('beforeunload', beforeUnload);
            document.addEventListener('click', click, true);
            detach = () => {
                window.removeEventListener('beforeunload', beforeUnload);
                document.removeEventListener('click', click, true);
            };
        }
        return () => {
            drafts.delete(current);
            if (!drafts.size) {
                detach?.();
                detach = null;
            }
        };
    }, [router]);
}
