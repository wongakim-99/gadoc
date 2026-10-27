import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { ISSUE_REPOSITORY, type IIssueRepository } from '../../domain/issue.port';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../../../document/domain/document.port';
import { MESSAGE_REPOSITORY, type IMessageRepository } from '../../../message/domain/message.port';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../../channel/domain/channel.port';
import { TeamAccessService } from '../../../team/application/services/team-access.service';
import type { IssueLink } from '../../domain/issue-link';

@Injectable()
export class IssueLinksService {
    constructor(
        @Inject(ISSUE_REPOSITORY) private readonly issues: IIssueRepository,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        @Inject(MESSAGE_REPOSITORY) private readonly messages: IMessageRepository,
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        private readonly access: TeamAccessService,
    ) {}

    async requireIssue(teamId: string, issueId: string) {
        if (!isMongoId(issueId)) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        const issue = await this.issues.findById(issueId);
        if (!issue || issue.teamId !== teamId) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        return issue;
    }

    private async resolve(teamId: string, userId: string, role: string, link: IssueLink) {
        if (!isMongoId(link.resourceId)) return null;
        if (link.kind === 'document') {
            const doc = await this.documents.findById(link.resourceId);
            if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role)) return null;
            return { ...link, title: doc.title, href: `/${teamId}/docs/${doc.id}` };
        }
        const message = await this.messages.findById(link.resourceId);
        if (!message || message.teamId !== teamId) return null;
        const channel = await this.channels.findById(message.channelId);
        if (
            !channel ||
            channel.teamId !== teamId ||
            (!['public', 'voice'].includes(channel.type) && !channel.isMember(userId))
        )
            return null;
        return {
            ...link,
            title: `#${channel.name} · ${message.content.slice(0, 100) || '첨부 메시지'}`,
            href: `/${teamId}/channel/${channel.id}?message=${message.id}&at=${encodeURIComponent(message.createdAt.toISOString())}`,
        };
    }

    async source(teamId: string, userId: string, resourceId: string): Promise<IssueLink> {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const link: IssueLink = { kind: 'message', resourceId, relation: 'origin' };
        if (!(await this.resolve(teamId, userId, role, link)))
            throw new NotFoundException('연결할 자료를 찾을 수 없습니다.');
        return link;
    }

    async list(teamId: string, userId: string, issueId: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        const issue = await this.requireIssue(teamId, issueId);
        const resolved = await Promise.all(issue.links.map((link) => this.resolve(teamId, userId, role, link)));
        // Do not expose even the IDs/count of resources hidden from this user.
        return resolved.filter((item) => item !== null);
    }

    async related(teamId: string, userId: string, kind: IssueLink['kind'], resourceId: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        if (!(await this.resolve(teamId, userId, role, { kind, resourceId, relation: 'reference' })))
            throw new NotFoundException('자료를 찾을 수 없습니다.');
        return this.issues.findLinked(teamId, { kind, resourceId });
    }

    async add(teamId: string, userId: string, issueId: string, kind: IssueLink['kind'], resourceId: string) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const issue = await this.requireIssue(teamId, issueId);
        const link: IssueLink = { kind, resourceId, relation: 'reference' };
        if (!(await this.resolve(teamId, userId, role, link)))
            throw new NotFoundException('연결할 자료를 찾을 수 없습니다.');
        const added = await this.issues.addLink(issue.id, teamId, link);
        if (!added) {
            const current = await this.requireIssue(teamId, issueId);
            if (!current.links.some((item) => item.kind === kind && item.resourceId === resourceId))
                throw new BadRequestException('한 이슈에는 최대 50개의 자료를 연결할 수 있습니다.');
        }
        return { links: await this.list(teamId, userId, issueId), created: added };
    }

    async remove(teamId: string, userId: string, issueId: string, kind: IssueLink['kind'], resourceId: string) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        await this.requireIssue(teamId, issueId);
        if (!(await this.resolve(teamId, userId, role, { kind, resourceId, relation: 'reference' })))
            throw new NotFoundException('연결할 자료를 찾을 수 없습니다.');
        await this.issues.removeLink(issueId, teamId, kind, resourceId);
    }
}
