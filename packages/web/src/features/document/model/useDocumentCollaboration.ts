'use client';
import { useEffect, useRef, useState } from 'react';
import { DocumentCollaborationProvider, type CollaborationState } from './DocumentCollaborationProvider';
import { useDatabaseDraftGuard } from '@/src/features/database/model/useDatabaseDraftGuard';

export function useDocumentCollaboration(teamId: string, documentId: string) {
    const current = useRef<DocumentCollaborationProvider | null>(null);
    const [provider, setProvider] = useState<DocumentCollaborationProvider | null>(null);
    const [state, setState] = useState<CollaborationState | null>(null);
    useDatabaseDraftGuard(
        () => current.current?.dirty ?? false,
        () => current.current?.flush() ?? true,
    );
    useEffect(() => {
        const live = new DocumentCollaborationProvider(teamId, documentId);
        current.current = live;
        setProvider(live);
        setState(live.state);
        let active = true;
        let scheduled = false;
        const unsubscribe = live.subscribe(() => {
            // Editor initialization publishes awareness during render. Coalesce
            // notifications after that render instead of updating its parent.
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                if (active) setState(live.state);
            });
        });
        const save = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void live.flush();
            }
        };
        window.addEventListener('keydown', save);
        return () => {
            active = false;
            current.current = null;
            unsubscribe();
            window.removeEventListener('keydown', save);
            // In-app navigation guards await this already; keep the last request alive on unmount.
            void live.flush().finally(() => live.destroy());
        };
    }, [teamId, documentId]);
    return { provider, state };
}
