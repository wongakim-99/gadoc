import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TeamAccess, type TeamAccessContext } from '../../../../shared/decorators/team-access.decorator';
import { ManageAnnouncementUseCase } from '../../application/use-cases/manage-announcement.use-case';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../../../shared/decorators/team-role.decorator';
import { CreateAnnouncementUseCase } from '../../application/use-cases/create-announcement.use-case';
import { GetAnnouncementsUseCase } from '../../application/use-cases/get-announcements.use-case';
import { PinAnnouncementUseCase } from '../../application/use-cases/pin-announcement.use-case';
import { BridgeEnqueueService } from '../../../bridge/application/services/bridge-enqueue.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { PinAnnouncementDto } from './dto/pin-announcement.dto';

/** 공지사항 API */
@ApiTags('announcement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/announcement')
export class AnnouncementController {
    constructor(
        private readonly createUseCase: CreateAnnouncementUseCase,
        private readonly getUseCase: GetAnnouncementsUseCase,
        private readonly pinUseCase: PinAnnouncementUseCase,
        private readonly bridgeEnqueueService: BridgeEnqueueService,
        private readonly manageUseCase: ManageAnnouncementUseCase,
    ) {}

    @Get()
    @TeamRole('member')
    @ApiOperation({ summary: '팀 공지사항 목록 조회 (핀 고정 우선)' })
    async getAnnouncements(@Param('teamId') teamId: string) {
        return this.getUseCase.execute(teamId);
    }

    @Post()
    @TeamRole('writable')
    @ApiOperation({ summary: '공지사항 생성' })
    async createAnnouncement(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateAnnouncementDto,
    ) {
        const announcement = await this.createUseCase.execute({ ...dto, teamId, createdBy: user.userId });
        await this.bridgeEnqueueService.enqueueAnnouncement(announcement);
        return announcement;
    }

    @Patch(':announcementId/pin')
    @TeamRole('writable')
    @ApiOperation({ summary: '공지사항 핀 고정/해제 (멤버만)' })
    async pinAnnouncement(
        @Param('teamId') teamId: string,
        @Param('announcementId') announcementId: string,
        @Body() dto: PinAnnouncementDto,
    ) {
        await this.manageUseCase.requireInTeam(teamId, announcementId);
        return this.pinUseCase.execute(announcementId, dto.isPinned);
    }

    @Patch(':announcementId')
    @TeamRole('writable')
    async updateAnnouncement(@Param('teamId') teamId: string, @Param('announcementId') id: string,
        @CurrentUser() user: { userId: string }, @TeamAccess() access: TeamAccessContext,
        @Body() dto: CreateAnnouncementDto) {
        return this.manageUseCase.update(teamId, id, user.userId, access.role, dto);
    }

    @Delete(':announcementId')
    @TeamRole('writable')
    async deleteAnnouncement(@Param('teamId') teamId: string, @Param('announcementId') id: string,
        @CurrentUser() user: { userId: string }, @TeamAccess() access: TeamAccessContext) {
        return this.manageUseCase.delete(teamId, id, user.userId, access.role);
    }
}
