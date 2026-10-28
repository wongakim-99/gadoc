import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';
import type { IIssueRepository } from '../../domain/issue.port';
import { ISSUE_REPOSITORY } from '../../domain/issue.port';
import { IssueEntity, IssueStatus, IssuePriority } from '../../domain/issue.entity';

export interface UpdateIssueInput {
    id: string;
    title?: string;
    description?: string;
    status?: IssueStatus;
    priority?: IssuePriority;
    assigneeIds?: string[];
    labels?: string[];
}

export interface UpdateIssueResult {
    updated: IssueEntity;
    /** 업데이트 전 담당자 목록 — 신규 담당자 계산에 사용 */
    previousAssigneeIds: string[];
}

@Injectable()
export class UpdateIssueUseCase {
    constructor(
        @Inject(ISSUE_REPOSITORY) private readonly issueRepo: IIssueRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    ) {}

    async execute(input: UpdateIssueInput): Promise<UpdateIssueResult> {
        const { id, ...data } = input;
        const before = await this.issueRepo.findById(id);
        if (!before) throw new BadRequestException('존재하지 않는 이슈입니다.');
        if (data.assigneeIds?.length) {
            const team = await this.teams.findById(before.teamId);
            if (data.assigneeIds.some((id) => !team?.getMember(id)))
                throw new BadRequestException('워크스페이스 멤버만 담당자로 지정할 수 있습니다.');
        }

        const previousAssigneeIds = before.assigneeIds ?? [];
        const updated = await this.issueRepo.update(id, data);
        if (!updated) throw new BadRequestException('존재하지 않는 이슈입니다.');

        return { updated, previousAssigneeIds };
    }
}
