import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';
import type { IIssueRepository } from '../../domain/issue.port';
import { ISSUE_REPOSITORY } from '../../domain/issue.port';
import { IssueEntity, IssuePriority, IssueStatus } from '../../domain/issue.entity';
import type { IssueLink } from '../../domain/issue-link';
import { ProjectService } from '../../../project/project.service';

export interface CreateIssueInput {
    projectId?: string | null;
    status?: IssueStatus;
    teamId: string;
    title: string;
    description?: string;
    priority?: IssuePriority;
    assigneeIds?: string[];
    labels?: string[];
    createdBy: string;
    links?: IssueLink[];
}

@Injectable()
export class CreateIssueUseCase {
    constructor(
        @Inject(ISSUE_REPOSITORY) private readonly issueRepo: IIssueRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        private readonly projects: ProjectService,
    ) {}

    async execute(input: CreateIssueInput): Promise<IssueEntity> {
        const projectId = input.projectId === undefined && input.links?.length
            ? await this.projects.fromOrigins(input.teamId, input.createdBy, input.links)
            : input.projectId ?? null;
        if (projectId !== null) await this.projects.requireProject(input.teamId, projectId);
        if (input.assigneeIds?.length) {
            const team = await this.teams.findById(input.teamId);
            if (input.assigneeIds.some((id) => !team?.getMember(id)))
                throw new BadRequestException('워크스페이스 멤버만 담당자로 지정할 수 있습니다.');
        }
        return this.issueRepo.save({
            projectId,
            status: input.status ?? 'todo',
            teamId: input.teamId,
            title: input.title,
            description: input.description ?? '',
            priority: input.priority ?? 'medium',
            assigneeIds: input.assigneeIds ?? [],
            labels: input.labels ?? [],
            createdBy: input.createdBy,
            links: input.links ?? [],
        });
    }
}
