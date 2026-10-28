import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ManageChannelUseCase } from '../../application/use-cases/manage-channel.use-case';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateChannelUseCase } from '../../application/use-cases/create-channel.use-case';
import { GetChannelsUseCase } from '../../application/use-cases/get-channels.use-case';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ArchiveChannelDto } from './dto/archive-channel.dto';
import { ArchiveChannelUseCase } from '../../application/use-cases/archive-channel.use-case';

/** 채널 API */
@ApiTags('channel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/channel')
export class ChannelController {
    constructor(
        private readonly createChannelUseCase: CreateChannelUseCase,
        private readonly getChannelsUseCase: GetChannelsUseCase,
        private readonly archiveChannelUseCase: ArchiveChannelUseCase,
        private readonly manageChannelUseCase: ManageChannelUseCase,
    ) {}

    @Get()
    @ApiOperation({ summary: '팀의 채널 목록 조회' })
    async getChannels(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        const channels = await this.getChannelsUseCase.execute(teamId, user.userId);
        return channels.map(({ channel, unreadCount, mentionCount, lastReadAt, lastMessageAt }) => ({
            ...channel.toPublic(),
            unreadCount,
            mentionCount,
            lastReadAt: lastReadAt?.toISOString() ?? null,
            lastMessageAt: lastMessageAt?.toISOString() ?? null,
        }));
    }

    @Post()
    @ApiOperation({ summary: '채널 생성' })
    async createChannel(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateChannelDto,
    ) {
        return this.createChannelUseCase.execute({
            teamId,
            createdBy: user.userId,
            ...dto,
        });
    }

    @Patch(':channelId/archive')
    async archiveChannel(
        @Param('teamId') teamId: string,
        @Param('channelId') channelId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: ArchiveChannelDto,
    ) {
        return this.archiveChannelUseCase.execute(teamId, channelId, user.userId, dto.isArchived);
    }

    @Patch(':channelId')
    async updateChannel(@Param('teamId') teamId: string, @Param('channelId') id: string,
        @CurrentUser() user: { userId: string }, @Body() dto: UpdateChannelDto) {
        return this.manageChannelUseCase.update(teamId, id, user.userId, dto);
    }

    @Delete(':channelId')
    async deleteChannel(@Param('teamId') teamId: string, @Param('channelId') id: string,
        @CurrentUser() user: { userId: string }) {
        return this.manageChannelUseCase.delete(teamId, id, user.userId);
    }
}
