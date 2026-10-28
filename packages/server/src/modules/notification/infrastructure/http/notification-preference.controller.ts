import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, Matches, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { NotificationPreferenceService } from '../../application/services/notification-preference.service';
import type { NotificationMode, UpdateNotificationPreference } from '../../domain/notification-preference';

export class UpdateNotificationPreferenceDto {
    @IsOptional() @IsIn(['all', 'mentions', 'off', 'inherit']) mode?: NotificationMode | 'inherit';
    @IsOptional() @Matches(/^[a-f0-9]{24}$/) channelId?: string;
    @IsOptional() @IsObject() kinds?: UpdateNotificationPreference['kinds'];
    @IsOptional() @IsBoolean() reset?: boolean;
    @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER - 1) revision: number;
}

@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/notification/preferences')
export class NotificationPreferenceController {
    constructor(private readonly preferences: NotificationPreferenceService) {}
    @Get()
    get(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.preferences.get(teamId, user.userId);
    }
    @Patch()
    update(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Body() input: UpdateNotificationPreferenceDto,
    ) {
        return this.preferences.update(teamId, user.userId, input);
    }
}
