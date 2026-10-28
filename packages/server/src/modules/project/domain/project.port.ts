import type { StoredWorkspaceProject } from './project';

export interface CreateWorkspaceProject {
    id?: string;
    teamId: string;
    name: string;
    channelIds: string[];
    documentId: string | null;
    createdBy: string;
}

export interface UpdateWorkspaceProject {
    name?: string;
    channelIds?: string[];
    documentId?: string | null;
    updatedBy: string;
}

export interface IProjectRepository {
    findByTeam(teamId: string): Promise<StoredWorkspaceProject[]>;
    findById(id: string): Promise<StoredWorkspaceProject | null>;
    findByChannel(teamId: string, channelId: string): Promise<StoredWorkspaceProject | null>;
    save(data: CreateWorkspaceProject): Promise<StoredWorkspaceProject>;
    update(
        id: string,
        teamId: string,
        revision: number,
        data: UpdateWorkspaceProject,
    ): Promise<StoredWorkspaceProject | null>;
}

export const PROJECT_REPOSITORY = Symbol('IProjectRepository');
