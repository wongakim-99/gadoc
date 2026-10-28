import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../domain/channel.port';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';

@Injectable()
export class ArchiveChannelUseCase {
    constructor(
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    ) {}

    async execute(teamId: string, channelId: string, userId: string, isArchived: boolean) {
        const [channel, team] = await Promise.all([this.channels.findById(channelId), this.teams.findById(teamId)]);
        if (!channel || channel.teamId !== teamId || !team) throw new BadRequestException('채널을 찾을 수 없습니다.');
        const member = team.getMember(userId);
        const canAccess = channel.type === 'public' || channel.type === 'voice' || channel.isMember(userId);
        if (
            !member ||
            member.role === 'guest' ||
            !canAccess ||
            (channel.createdBy !== userId && member.role !== 'owner' && member.role !== 'admin')
        ) {
            throw new ForbiddenException('채널 생성자 또는 접근 권한이 있는 관리자만 채널을 보관·복원할 수 있습니다.');
        }
        if (channel.type === 'dm' || channel.type === 'group')
            throw new BadRequestException('개인 대화는 보관할 수 없습니다.');
        return this.channels.setArchived(channelId, isArchived);
    }
}
