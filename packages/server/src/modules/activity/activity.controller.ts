import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { ActivityService } from './activity.service';

/** 워크스페이스 운영자만 해당 팀의 활동 기록을 조회할 수 있다. */
@Controller('team/:teamId/access-events')
@UseGuards(JwtAuthGuard)
export class ActivityController {
    constructor(
        private readonly activity: ActivityService,
        private readonly access: TeamAccessService,
    ) {}

    @Get()
    async list(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Query('actorId') actorId?: string,
        @Query('before') before?: string,
        @Query('limit') limit?: string,
    ) {
        await this.access.requireAdmin(teamId, user.userId);
        return this.activity.list(teamId, { actorId, before, limit });
    }
}
