export interface WorkspaceProject {
    id: string;
    teamId: string;
    name: string;
    channelIds: string[];
    documentId: string | null;
    revision: number;
}

export interface ProjectFields {
    name: string;
    channelIds: string[];
    documentId: string | null;
}
