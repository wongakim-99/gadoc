import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';
import { USER_REPOSITORY, type IUserRepository } from '../../../auth/domain/auth.port';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../../channel/domain/channel.port';
import { extractMentionTokens, resolveMentionUserIds } from '../../../../shared/lib/mention-extraction';

@Injectable()
export class MessageMentionsService {
    constructor(
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
    ) {}

    async resolve(teamId: string, channelId: string, authorId: string, content: string): Promise<string[]> {
        const [team, channel] = await Promise.all([this.teams.findById(teamId), this.channels.findById(channelId)]);
        if (!team || !channel || channel.teamId !== teamId || channel.isArchived)
            throw new BadRequestException('메시지를 작성할 채널을 확인할 수 없습니다.');
        const publicChannel = channel.type === 'public' || channel.type === 'voice';
        if (!team.isMember(authorId) || (!publicChannel && !channel.isMember(authorId)))
            throw new ForbiddenException('이 채널에 메시지를 작성할 권한이 없습니다.');
        const tokens = extractMentionTokens(content);
        if (tokens.length === 0) return [];
        const eligible = team.members
            .map((member) => member.userId)
            .filter((id) => publicChannel || channel.isMember(id));
        const users = await this.users.findByIds(eligible);
        const recipients = users.filter((user) => eligible.includes(user.id));
        if (tokens.some((token) => ['all', 'everyone', 'channel', '전체'].includes(token)))
            return [...new Set(recipients.map((user) => user.id).filter((id) => id !== authorId))];
        return resolveMentionUserIds(
            tokens,
            recipients.map((user) => ({ userId: user.id, username: user.username })),
            authorId,
        );
    }
}
