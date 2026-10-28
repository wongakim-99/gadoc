import type { IssueLink } from './issue-link';
import type { WorkspaceProject } from '../../project/domain/project';

export type IssueProject = WorkspaceProject;

export interface IssueOriginMessage {
    id: string;
    teamId: string;
    channelId: string;
}

export type IssueProjectResolution =
    | { projectId: string; reason: 'matched' }
    | {
          projectId: null;
          reason: 'no_origin' | 'missing_origin' | 'foreign_origin' | 'unassigned_origin' | 'ambiguous_origin';
      };

export function resolveIssueProject(
    teamId: string,
    links: readonly IssueLink[],
    projects: readonly IssueProject[],
    messages: readonly IssueOriginMessage[],
): IssueProjectResolution {
    const origins = links.filter((link) => link.kind === 'message' && link.relation === 'origin');
    if (!origins.length) return { projectId: null, reason: 'no_origin' };
    const candidates = new Set<string>();
    for (const origin of origins) {
        // Never guess from a reference when an origin is hidden, missing or belongs to another team.
        const message = messages.find((item) => item.id === origin.resourceId);
        if (!message) return { projectId: null, reason: 'missing_origin' };
        if (message.teamId !== teamId) return { projectId: null, reason: 'foreign_origin' };
        const matches = projects.filter(
            (project) => project.teamId === teamId && project.channelIds.includes(message.channelId),
        );
        if (!matches.length) return { projectId: null, reason: 'unassigned_origin' };
        for (const project of matches) candidates.add(project.id);
    }
    if (candidates.size !== 1) return { projectId: null, reason: 'ambiguous_origin' };
    return { projectId: [...candidates][0], reason: 'matched' };
}

interface ClassifiableIssue {
    id: string;
    teamId: string;
    projectId?: string | null;
    links: readonly IssueLink[];
    updatedAt: Date;
}

export function planIssueProjectAssignments(
    teamId: string,
    issues: readonly ClassifiableIssue[],
    projects: readonly IssueProject[],
    messages: readonly IssueOriginMessage[],
) {
    if (!teamId) throw new Error('A workspace is required for issue classification.');
    const assignments: Array<{ issueId: string; projectId: string; expectedUpdatedAt: string }> = [];
    const skipped: Array<{ issueId: string; reason: string }> = [];
    for (const issue of issues) {
        if (issue.teamId !== teamId) continue;
        if (issue.projectId) {
            skipped.push({ issueId: issue.id, reason: 'already_classified' });
            continue;
        }
        const result = resolveIssueProject(teamId, issue.links, projects, messages);
        if (result.projectId && Number.isFinite(issue.updatedAt.getTime())) {
            assignments.push({
                issueId: issue.id,
                projectId: result.projectId,
                expectedUpdatedAt: issue.updatedAt.toISOString(),
            });
        } else {
            skipped.push({ issueId: issue.id, reason: result.projectId ? 'invalid_timestamp' : result.reason });
        }
    }
    return { assignments, skipped };
}
