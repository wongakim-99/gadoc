import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../../channel/domain/channel.port';
import { MESSAGE_REPOSITORY, type IMessageRepository } from '../../../message/domain/message.port';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../../../document/domain/document.port';
import { Issue } from '../../../issue/infrastructure/persistence/issue.schema';
import { TeamAccessService } from '../../../team/application/services/team-access.service';
import { channelVisibleForNotifications, type NotificationKind } from '../../domain/notification-preference';

interface NotificationResource {
    teamId: string;
    recipientId: string;
    type: string;
    resourceType: string;
    resourceId: string;
    channelId: string | null;
}

export interface NotificationContext {
    channelId: string | null;
    related: boolean;
    kind: NotificationKind;
}

/** Resolve scope from stored resources, never from client-supplied category/channel hints. */
@Injectable()
export class NotificationResourceService {
    constructor(
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        @Inject(MESSAGE_REPOSITORY) private readonly messages: IMessageRepository,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        @InjectModel(Issue.name) private readonly issues: Model<Issue>,
        private readonly teams: TeamAccessService,
    ) {}

    async messageContext(teamId: string, userId: string, id: string): Promise<NotificationContext | null> {
        if (!/^[a-f0-9]{24}$/.test(id)) return null;
        const message = await this.messages.findById(id);
        if (!message || message.teamId !== teamId || message.authorId === userId) return null;
        const channel = await this.channels.findById(message.channelId);
        if (!channel || !channelVisibleForNotifications(channel, teamId, userId)) return null;
        const mentioned = message.mentions.includes(userId);
        let related = channel.type === 'dm' || channel.type === 'group' || mentioned;
        if (!related && message.replyToId) {
            const parent = await this.messages.findById(message.replyToId);
            related = parent?.teamId === teamId && parent.channelId === channel.id && parent.authorId === userId;
        }
        // A message has one category on both the chat and inbox paths: mention > thread > chat.
        return { channelId: channel.id, related, kind: mentioned ? 'mention' : message.replyToId ? 'thread' : 'chat' };
    }

    async notificationContext(
        teamId: string,
        userId: string,
        notice: NotificationResource,
        role: string,
    ): Promise<NotificationContext | null> {
        if (notice.teamId !== teamId || notice.recipientId !== userId || !/^[a-f0-9]{24}$/.test(notice.resourceId))
            return null;
        if (notice.resourceType === 'message') {
            const context = await this.messageContext(teamId, userId, notice.resourceId);
            if (!context || (notice.channelId && notice.channelId !== context.channelId)) return null;
            return context;
        }
        let channelId: string | null = null;
        if (notice.channelId) {
            const channel = await this.channels.findById(notice.channelId);
            if (!channel || !channelVisibleForNotifications(channel, teamId, userId)) return null;
            channelId = channel.id;
        }
        if (notice.resourceType === 'document') {
            const document = await this.documents.findById(notice.resourceId);
            if (!document || document.teamId !== teamId || document.isArchived || !document.canView(userId, role))
                return null;
        } else if (notice.resourceType === 'issue') {
            const issue = await this.issues.findById(notice.resourceId).lean();
            if (!issue || String(issue.teamId) !== teamId) return null;
        } else return null;
        const kind: NotificationKind =
            notice.type === 'mention'
                ? 'mention'
                : notice.type === 'thread_reply'
                  ? 'thread'
                  : notice.type === 'issue_updated'
                    ? 'update'
                    : notice.resourceType === 'document'
                      ? 'document'
                      : 'issue';
        return { channelId, kind, related: notice.type !== 'issue_updated' };
    }

    async filterVisible<T extends NotificationResource>(teamId: string, userId: string, notices: T[]): Promise<T[]> {
        const { role } = await this.teams.requireMember(teamId, userId);
        const visible = await Promise.all(
            notices.map((notice) => this.notificationContext(teamId, userId, notice, role)),
        );
        return notices.filter((_, index) => visible[index] !== null);
    }
}
