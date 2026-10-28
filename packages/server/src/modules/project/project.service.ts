import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../channel/domain/channel.port';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../document/domain/document.port';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { PROJECT_REPOSITORY, type IProjectRepository } from './domain/project.port';
import type { StoredWorkspaceProject } from './domain/project';
import { MESSAGE_REPOSITORY, type IMessageRepository } from '../message/domain/message.port';
import type { IssueLink } from '../issue/domain/issue-link';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONTENT_CHANGED } from '../../shared/interceptors/content-change.interceptor';
import { resolveIssueProject, type IssueOriginMessage } from '../issue/domain/issue-project';

export interface ProjectFields {
    name: string;
    channelIds: string[];
    documentId: string | null;
}

@Injectable()
export class ProjectService {
    constructor(
        @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        private readonly access: TeamAccessService,
        @Inject(MESSAGE_REPOSITORY) private readonly messages: IMessageRepository,
        private readonly events: EventEmitter2,
    ) {}

    async requireProject(teamId: string, id: string) {
        if (!isMongoId(id)) throw new NotFoundException('업무를 찾을 수 없습니다.');
        const project = await this.projects.findById(id);
        if (!project || project.teamId !== teamId) throw new NotFoundException('업무를 찾을 수 없습니다.');
        return project;
    }

    private async visibleChannels(teamId: string, userId: string, ids: readonly string[]) {
        const channels = await Promise.all(ids.map((id) => this.channels.findById(id)));
        return channels
            .filter(
                (channel) =>
                    channel &&
                    channel.teamId === teamId &&
                    ['public', 'private', 'voice'].includes(channel.type) &&
                    (channel.type !== 'private' || channel.isMember(userId)),
            )
            .map((channel) => channel!.id);
    }

    private async publicProject(project: StoredWorkspaceProject, userId: string, role: string) {
        const document = project.documentId ? await this.documents.findById(project.documentId) : null;
        return {
            ...project,
            channelIds: await this.visibleChannels(project.teamId, userId, project.channelIds),
            documentId:
                document && document.teamId === project.teamId && !document.isArchived && document.canView(userId, role)
                    ? document.id
                    : null,
        };
    }

    async list(teamId: string, userId: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        return Promise.all((await this.projects.findByTeam(teamId)).map((p) => this.publicProject(p, userId, role)));
    }

    async forChannel(teamId: string, userId: string, channelId: string) {
        await this.access.requireMember(teamId, userId);
        if (!isMongoId(channelId) || !(await this.visibleChannels(teamId, userId, [channelId])).length)
            throw new NotFoundException('채널을 찾을 수 없습니다.');
        return (await this.projects.findByChannel(teamId, channelId))?.id ?? null;
    }

    async fromOrigins(teamId: string, userId: string, links: readonly IssueLink[]) {
        const origins = links.filter((link) => link.kind === 'message' && link.relation === 'origin');
        if (!origins.length) return null;
        await this.access.requireMember(teamId, userId);
        const messages: IssueOriginMessage[] = [];
        for (const link of origins) {
            const message = isMongoId(link.resourceId) ? await this.messages.findById(link.resourceId) : null;
            if (!message || message.teamId !== teamId) throw new NotFoundException('생성 근거를 찾을 수 없습니다.');
            const channel = await this.channels.findById(message.channelId);
            if (
                !channel ||
                channel.teamId !== teamId ||
                (!['public', 'voice'].includes(channel.type) && !channel.isMember(userId))
            )
                throw new NotFoundException('생성 근거를 찾을 수 없습니다.');
            messages.push({ id: message.id, teamId, channelId: message.channelId });
        }
        const result = resolveIssueProject(teamId, links, await this.projects.findByTeam(teamId), messages);
        if (result.reason === 'ambiguous_origin')
            throw new BadRequestException('서로 다른 업무의 생성 근거입니다. 업무를 직접 선택하세요.');
        return result.projectId;
    }

    private async validate(teamId: string, userId: string, fields: ProjectFields, role: string) {
        if (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 80)
            throw new BadRequestException('업무 이름은 1~80자로 입력하세요.');
        if (
            !Array.isArray(fields.channelIds) ||
            fields.channelIds.length > 100 ||
            fields.channelIds.some((id) => typeof id !== 'string' || !isMongoId(id)) ||
            new Set(fields.channelIds).size !== fields.channelIds.length
        )
            throw new BadRequestException('연결할 채널을 확인하세요.');
        if ((await this.visibleChannels(teamId, userId, fields.channelIds)).length !== fields.channelIds.length)
            throw new BadRequestException('접근 가능한 이 워크스페이스 채널만 연결할 수 있습니다.');
        if (fields.documentId !== null) {
            if (!isMongoId(fields.documentId)) throw new BadRequestException('연결할 문서를 확인하세요.');
            const doc = await this.documents.findById(fields.documentId);
            if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
                throw new BadRequestException('접근 가능한 이 워크스페이스 문서만 연결할 수 있습니다.');
        }
    }

    private duplicate(error: unknown): never {
        if ((error as { code?: number }).code === 11000)
            throw new ConflictException('같은 업무 이름 또는 이미 다른 업무에 연결된 채널입니다.');
        throw error;
    }

    async create(teamId: string, userId: string, fields: ProjectFields) {
        const { role } = await this.access.requireAdmin(teamId, userId);
        await this.validate(teamId, userId, fields, role);
        try {
            const project = await this.projects.save({ ...fields, teamId, createdBy: userId });
            this.events.emit(CONTENT_CHANGED, { teamId, sourceId: project.id, resourceKind: 'project' });
            return project;
        } catch (error) {
            this.duplicate(error);
        }
    }

    async update(teamId: string, userId: string, id: string, revision: number, fields: ProjectFields) {
        const { role } = await this.access.requireAdmin(teamId, userId);
        const before = await this.requireProject(teamId, id);
        // Never let an editor silently remove bindings they could not see in the form.
        await this.validate(
            teamId,
            userId,
            { name: before.name, channelIds: [...before.channelIds], documentId: before.documentId },
            role,
        );
        await this.validate(teamId, userId, fields, role);
        if (!Number.isInteger(revision) || revision < 0) throw new BadRequestException('변경 버전을 확인하세요.');
        try {
            const result = await this.projects.update(id, teamId, revision, { ...fields, updatedBy: userId });
            if (!result) throw new ConflictException('다른 화면에서 업무가 변경되었습니다. 다시 열어 확인하세요.');
            this.events.emit(CONTENT_CHANGED, { teamId, sourceId: id, resourceKind: 'project' });
            return result;
        } catch (error) {
            this.duplicate(error);
        }
    }
}
