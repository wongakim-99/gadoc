export interface WorkspaceProject {
    id: string;
    teamId: string;
    name: string;
    channelIds: readonly string[];
    documentId: string | null;
}

export interface StoredWorkspaceProject extends WorkspaceProject {
    revision: number;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export function projectNameKey(name: string) {
    return name.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}
