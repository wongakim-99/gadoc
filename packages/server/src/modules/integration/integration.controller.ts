import { Body, Controller, Delete, Get, Header, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../shared/decorators/team-role.decorator';
import { IntegrationTokenService } from './integration-token.service';

@Controller('team/:teamId/integrations')
@TeamRole('member')
export class IntegrationController {
    constructor(private readonly tokens: IntegrationTokenService) {}

    @Get('tokens')
    @Header('Cache-Control', 'private, no-store')
    list(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.tokens.list(teamId, user.userId);
    }

    @Post('tokens')
    @Header('Cache-Control', 'private, no-store')
    issue(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }, @Body() input: unknown) {
        return this.tokens.issue(teamId, user.userId, input);
    }

    @Delete('tokens/:id')
    revoke(@Param('teamId') teamId: string, @Param('id') id: string, @CurrentUser() user: { userId: string }) {
        return this.tokens.revoke(teamId, user.userId, id);
    }

    @Get('activity')
    @Header('Cache-Control', 'private, no-store')
    activity(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.tokens.activity(teamId, user.userId);
    }
}
