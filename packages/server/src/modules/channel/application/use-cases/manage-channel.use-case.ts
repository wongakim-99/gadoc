import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../domain/channel.port';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';

@Injectable()
export class ManageChannelUseCase {
    constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository) {}

    private async authorize(teamId: string, id: string, userId: string) {
        if (!/^[a-f\d]{24}$/i.test(id)) throw new NotFoundException('채널을 찾을 수 없습니다.');
        const [channel, team] = await Promise.all([this.channels.findById(id), this.teams.findById(teamId)]);
        if (!channel || channel.teamId !== teamId || !team) throw new NotFoundException('채널을 찾을 수 없습니다.');
        const member = team.getMember(userId);
        const hasAccess = channel.type === 'public' || channel.type === 'voice' || channel.isMember(userId);
        if (!member || member.role === 'guest' || !hasAccess ||
            (channel.createdBy !== userId && member.role !== 'owner' && member.role !== 'admin')) {
            throw new ForbiddenException('채널 생성자 또는 접근 권한이 있는 관리자만 변경할 수 있습니다.');
        }
        if (channel.type === 'dm' || channel.type === 'group') throw new BadRequestException('개인 대화에는 이 작업을 사용할 수 없습니다.');
    }

    async update(teamId: string, id: string, userId: string, fields: { name: string; description?: string }) {
        await this.authorize(teamId, id, userId);
        const name = fields.name.trim();
        if (!name) throw new BadRequestException('채널 이름을 입력해 주세요.');
        try {
            const channel = await this.channels.updateDetails(id, teamId, name, fields.description?.trim() || null);
            if (!channel) throw new NotFoundException('채널을 찾을 수 없습니다.');
            return channel;
        } catch (error) {
            if ((error as { code?: number }).code === 11000) throw new ConflictException('이미 사용 중인 채널 이름입니다.');
            throw error;
        }
    }

    async delete(teamId: string, id: string, userId: string) {
        await this.authorize(teamId, id, userId);
        if (!(await this.channels.deleteInTeam(id, teamId))) throw new NotFoundException('채널을 찾을 수 없습니다.');
        return { deleted: true };
    }
}
