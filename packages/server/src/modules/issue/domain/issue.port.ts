import { IssueEntity, IssueStatus, IssuePriority } from './issue.entity';
import type { IssueLink } from './issue-link';

export interface IssueSearchFilters {
    status?: IssueStatus;
    query?: string;
    assigneeId?: string;
}

export interface IIssueRepository {
    findLinked(teamId: string, link: Pick<IssueLink, 'kind' | 'resourceId'>): Promise<IssueEntity[]>;
    addLink(id: string, teamId: string, link: IssueLink): Promise<boolean>;
    removeLink(id: string, teamId: string, kind: IssueLink['kind'], resourceId: string): Promise<void>;
    findByTeam(teamId: string, filters?: IssueSearchFilters): Promise<IssueEntity[]>;
    findById(id: string): Promise<IssueEntity | null>;
    save(data: {
        teamId: string;
        title: string;
        description: string;
        priority: IssuePriority;
        assigneeIds: string[];
        labels: string[];
        createdBy: string;
        links?: IssueLink[];
    }): Promise<IssueEntity>;
    update(
        id: string,
        data: Partial<{
            title: string;
            description: string;
            status: IssueStatus;
            priority: IssuePriority;
            assigneeIds: string[];
            labels: string[];
        }>,
        revision?: number,
    ): Promise<IssueEntity | null>;
    deleteById(id: string): Promise<boolean>;
}

export const ISSUE_REPOSITORY = Symbol('IIssueRepository');
