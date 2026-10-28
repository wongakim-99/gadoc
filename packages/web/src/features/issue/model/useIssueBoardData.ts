'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeDatabaseChanges } from '@/src/features/database/model/databaseSocket';
import { useSearchParams } from 'next/navigation';
import { issueApi, unwrapApiArray } from '@/lib/api-client';
import { useIssueStore } from './issue.store';
import { getIssuesByStatus } from './getIssuesByStatus';
import type { Issue, IssueStatus } from '@/src/entities/issue/types';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';

interface IssueBoardFiltersState {
    query: string;
    assigneeId: string;
    statusFilter: IssueStatus | 'all';
}

interface Props {
    teamId: string;
    filters: IssueBoardFiltersState;
}

export function useIssueBoardData({ teamId, filters }: Props) {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('project') ?? '';
    const updatedAfter = searchParams.get('updatedAfter') ?? '';
    const cutoff = Number.isFinite(Date.parse(updatedAfter)) ? Date.parse(updatedAfter) : 0;
    const { issues, setIssues, setLoading } = useIssueStore();
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
    const workspace = useTeamWorkspaceData(teamId);
    const requestVersion = useRef(0);

    const loadIssues = useCallback(async () => {
        const version = ++requestVersion.current;
        setLoading(true);
        try {
            const response = await issueApi.getIssues(teamId, {
                query: filters.query,
                assigneeId: filters.assigneeId || undefined,
                status: filters.statusFilter === 'all' ? undefined : filters.statusFilter,
                projectId: projectId || undefined,
            });
            if (version === requestVersion.current) setIssues(unwrapApiArray<Issue>(response).filter((issue) => !cutoff || Date.parse(issue.updatedAt) >= cutoff));
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [filters.assigneeId, filters.query, filters.statusFilter, projectId, cutoff, setIssues, setLoading, teamId]);

    useEffect(() => {
        const timeout = window.setTimeout(
            () => {
                void loadIssues();
            },
            filters.query ? 180 : 0,
        );

        return () => window.clearTimeout(timeout);
    }, [filters.query, loadIssues]);

    useEffect(() => {
        const refresh = () => {
            void loadIssues();
        };
        window.addEventListener('slacord:issues-refresh', refresh);
        return () => window.removeEventListener('slacord:issues-refresh', refresh);
    }, [loadIssues]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const unsubscribe = subscribeDatabaseChanges(teamId, () => {
            clearTimeout(timer);
            timer = setTimeout(() => { void loadIssues(); }, 150);
        });
        return () => { clearTimeout(timer); unsubscribe(); requestVersion.current++; };
    }, [teamId, loadIssues]);

    useEffect(() => {
        const focusIssueId = searchParams.get('issue');
        if (focusIssueId) setSelectedIssueId(focusIssueId);
    }, [searchParams]);

    const selectedIssue = useMemo(
        () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
        [issues, selectedIssueId],
    );

    return {
        canWrite: workspace.canWrite,
        projectId,
        issues,
        issuesByStatus: getIssuesByStatus(issues),
        loadIssues,
        members: workspace.members,
        selectedIssue,
        setSelectedIssueId,
    };
}
