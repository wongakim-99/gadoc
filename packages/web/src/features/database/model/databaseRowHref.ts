import type { DatabaseRow } from './types';

export function databaseRowHref(teamId: string, row: Pick<DatabaseRow, 'documentId' | 'resourceKind'>) {
    return row.resourceKind === 'issue'
        ? `/${teamId}/issues?issue=${encodeURIComponent(row.documentId)}`
        : `/${teamId}/docs/${row.documentId}`;
}
