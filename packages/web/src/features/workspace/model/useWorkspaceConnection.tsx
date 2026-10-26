'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import type { WorkspaceReference } from './workspaceReference';

export const WorkspaceConnection = createContext<{
    teamId: string;
    embedded: boolean;
    pending: WorkspaceReference | null;
    offer: (reference: WorkspaceReference | null) => void;
    open: (href: string, label?: string) => void;
} | null>(null);

export const useWorkspaceConnection = () => useContext(WorkspaceConnection);

const guards = new Set<() => Promise<boolean> | boolean>();
export async function canLeaveWorkspacePane() {
    for (const guard of guards) if (!(await guard())) return false;
    return true;
}

export function useWorkspaceLeaveGuard(guard: () => Promise<boolean> | boolean) {
    const current = useRef(guard);
    current.current = guard;
    useEffect(() => {
        const check = () => current.current();
        guards.add(check);
        return () => {
            guards.delete(check);
        };
    }, []);
}
