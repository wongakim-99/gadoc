import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../../../shared/decorators/team-role.decorator';
import { CreateIssueUseCase } from '../../application/use-cases/create-issue.use-case';
import { UpdateIssueUseCase } from '../../application/use-cases/update-issue.use-case';
import { GetIssuesUseCase } from '../../application/use-cases/get-issues.use-case';
import { DeleteIssueUseCase } from '../../application/use-cases/delete-issue.use-case';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import type { IssueStatus } from '../../domain/issue.entity';
import { IssueNotificationService } from '../../application/services/issue-notification.service';
import { IssueLinksService } from '../../application/services/issue-links.service';
import { IssueLinkDto } from './dto/issue-link.dto';

/** 이슈 트래커 API */
@ApiTags('issue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/issue')
export class IssueController {
    constructor(
        private readonly links: IssueLinksService,
        private readonly createIssueUseCase: CreateIssueUseCase,
        private readonly updateIssueUseCase: UpdateIssueUseCase,
        private readonly getIssuesUseCase: GetIssuesUseCase,
        private readonly deleteIssueUseCase: DeleteIssueUseCase,
        private readonly issueNotificationService: IssueNotificationService,
    ) {}

    @Get()
    @TeamRole('member')
    @ApiOperation({ summary: '팀 이슈 목록 조회 (status 필터 가능)' })
    @ApiQuery({ name: 'status', required: false, enum: ['todo', 'in_progress', 'in_review', 'done'] })
    @ApiQuery({ name: 'q', required: false, type: String })
    @ApiQuery({ name: 'assigneeId', required: false, type: String })
    async getIssues(
        @Param('teamId') teamId: string,
        @Query('status') status?: string,
        @Query('q') query?: string,
        @Query('assigneeId') assigneeId?: string,
        @Query('projectId') projectId?: string,
    ) {
        if (projectId !== undefined && (typeof projectId !== 'string' ||
            (projectId !== 'unassigned' && !isMongoId(projectId))))
            throw new BadRequestException('업무 범위를 확인하세요.');
        return this.getIssuesUseCase.execute(teamId, {
            status: status as IssueStatus | undefined,
            query,
            assigneeId,
            ...(projectId ? { projectId: projectId === 'unassigned' ? null : projectId } : {}),
        });
    }

    @Get('related')
    @TeamRole('member')
    related(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }, @Query() query: IssueLinkDto) {
        return this.links.related(teamId, user.userId, query.kind, query.resourceId);
    }

    @Get(':issueId/links')
    @TeamRole('member')
    listLinks(
        @Param('teamId') teamId: string,
        @Param('issueId') issueId: string,
        @CurrentUser() user: { userId: string },
    ) {
        return this.links.list(teamId, user.userId, issueId);
    }

    @Post(':issueId/links')
    @TeamRole('writable')
    addLink(
        @Param('teamId') teamId: string,
        @Param('issueId') issueId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: IssueLinkDto,
    ) {
        return this.links.add(teamId, user.userId, issueId, dto.kind, dto.resourceId);
    }

    @Delete(':issueId/links')
    @TeamRole('writable')
    removeLink(
        @Param('teamId') teamId: string,
        @Param('issueId') issueId: string,
        @CurrentUser() user: { userId: string },
        @Query() query: IssueLinkDto,
    ) {
        return this.links.remove(teamId, user.userId, issueId, query.kind, query.resourceId);
    }

    @Post()
    @TeamRole('writable')
    @ApiOperation({ summary: '이슈 생성' })
    async createIssue(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateIssueDto,
    ) {
        const { sourceMessageId, ...fields } = dto;
        const links = sourceMessageId ? [await this.links.source(teamId, user.userId, sourceMessageId)] : [];
        const issue = await this.createIssueUseCase.execute({ ...fields, teamId, createdBy: user.userId, links });
        void this.issueNotificationService.notifyAssignees({
            teamId,
            actorId: user.userId,
            assigneeIds: dto.assigneeIds,
            issueId: issue.id,
            issueTitle: issue.title,
        });
        return issue;
    }

    @Patch(':issueId')
    @TeamRole('writable')
    @ApiOperation({ summary: '이슈 수정 (상태 이동 포함)' })
    async updateIssue(
        @Param('teamId') teamId: string,
        @Param('issueId') issueId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: UpdateIssueDto,
    ) {
        await this.links.requireIssue(teamId, issueId);
        const { updated: issue, previousAssigneeIds } = await this.updateIssueUseCase.execute({
            id: issueId,
            ...dto,
            actorId: user.userId,
        });
        const newAssigneeIds = (dto.assigneeIds ?? []).filter((id) => !previousAssigneeIds.includes(id));
        if (newAssigneeIds.length > 0) {
            void this.issueNotificationService.notifyAssignees({
                teamId,
                actorId: user.userId,
                assigneeIds: newAssigneeIds,
                issueId: issue.id,
                issueTitle: issue.title,
            });
        }
        return issue;
    }

    @Delete(':issueId')
    @TeamRole('writable')
    @ApiOperation({ summary: '이슈 삭제' })
    async deleteIssue(@Param('teamId') teamId: string, @Param('issueId') issueId: string) {
        await this.links.requireIssue(teamId, issueId);
        await this.deleteIssueUseCase.execute(issueId);
    }
}
