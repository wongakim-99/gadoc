'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IssueStatus } from '@/src/entities/issue/types';

export function useIssueBoardFilters() {
    const params = useSearchParams();
    const requestedStatus = params.get('filterStatus') ?? '';
    const requestedAssignee = params.get('filterAssignee') ?? '';
    const [query, setQuery] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');

    useEffect(() => {
        setStatusFilter(['todo', 'in_progress', 'in_review', 'done'].includes(requestedStatus) ? requestedStatus as IssueStatus : 'all');
        setAssigneeId(requestedAssignee);
    }, [requestedStatus, requestedAssignee]);

    return {
        query,
        assigneeId,
        statusFilter,
        setQuery,
        setAssigneeId,
        setStatusFilter,
    };
}
