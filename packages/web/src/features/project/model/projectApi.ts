import { apiFetch } from '@/lib/api-client';
import type { ProjectFields, WorkspaceProject } from '@/src/entities/project/types';

export const projectApi = {
    list: (teamId: string) => apiFetch<WorkspaceProject[]>(`/api/team/${teamId}/project`),
    create: (teamId: string, fields: ProjectFields) =>
        apiFetch<WorkspaceProject>(`/api/team/${teamId}/project`, {
            method: 'POST',
            body: JSON.stringify(fields),
        }),
    update: (teamId: string, id: string, fields: ProjectFields, revision: number) =>
        apiFetch<WorkspaceProject>(`/api/team/${teamId}/project/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...fields, revision }),
        }),
};
