'use client';

import { useEffect, useState } from 'react';
import type { WorkspaceProject } from '@/src/entities/project/types';
import { projectApi } from './projectApi';
import { subscribeDatabaseChanges } from '@/src/features/database/model/databaseSocket';

export function useProjects(teamId: string) {
    const [result, setResult] = useState<{ teamId: string; projects: WorkspaceProject[]; error: string }>();
    useEffect(() => {
        let active = true;
        let version = 0;
        const load = async () => {
            const request = ++version;
            try {
                const response = await projectApi.list(teamId);
                if (!response.success || !response.data) throw new Error('업무 목록을 불러오지 못했습니다.');
                if (active && version === request) setResult({ teamId, projects: response.data, error: '' });
            } catch (error) {
                if (active && version === request)
                    setResult({
                        teamId,
                        projects: [],
                        error: error instanceof Error ? error.message : '업무 목록을 불러오지 못했습니다.',
                    });
            }
        };
        const refresh = () => {
            void load();
        };
        refresh();
        window.addEventListener('gadoc:projects-refresh', refresh);
        window.addEventListener('focus', refresh);
        const unsubscribe = subscribeDatabaseChanges(teamId, (event) => {
            if (event.resourceKind === 'project') refresh();
        });
        return () => {
            active = false;
            unsubscribe();
            window.removeEventListener('gadoc:projects-refresh', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [teamId]);
    return {
        projects: result?.teamId === teamId ? result.projects : [],
        error: result?.teamId === teamId ? result.error : '',
        loading: result?.teamId !== teamId,
    };
}
