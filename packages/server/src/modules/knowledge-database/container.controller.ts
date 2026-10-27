import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsMongoId, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../shared/decorators/team-role.decorator';
import { ContentChangeInterceptor } from '../../shared/interceptors/content-change.interceptor';
import { DatabaseContainerService } from './container.service';
class CreateContainerDto {
    @IsOptional() @IsBoolean() blank?: boolean;
    @IsOptional() @IsMongoId() parentDocumentId?: string;
    @IsOptional() @IsMongoId() creationId?: string;
    @IsString() @MinLength(1) @MaxLength(100) name!: string;
}
class SourceLinkDto {
    @IsMongoId() sourceId!: string;
    @IsInt() @Min(0) revision!: number;
}
class CreateSourceDto extends CreateContainerDto {
    @IsInt() @Min(0) revision!: number;
}
@UseGuards(JwtAuthGuard)
@UseInterceptors(ContentChangeInterceptor)
@Controller('team/:teamId/database-container')
export class DatabaseContainerController {
    constructor(private readonly service: DatabaseContainerService) {}
    @Post()
    @TeamRole('writable')
    create(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }, @Body() dto: CreateContainerDto) {
        return this.service.create(teamId, user.userId, dto.name, dto.creationId, dto.parentDocumentId, dto.blank);
    }
    @Get(':id')
    @TeamRole('member')
    read(@Param('teamId') teamId: string, @Param('id') id: string, @CurrentUser() user: { userId: string }) {
        return this.service.read(teamId, user.userId, id);
    }
    @Post(':id/source')
    @TeamRole('writable')
    createSource(
        @Param('teamId') teamId: string,
        @Param('id') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateSourceDto,
    ) {
        return this.service.createSource(teamId, user.userId, id, dto.name, dto.revision, dto.creationId, dto.blank);
    }
    @Post(':id/source/link')
    @TeamRole('writable')
    link(
        @Param('teamId') teamId: string,
        @Param('id') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: SourceLinkDto,
    ) {
        return this.service.link(teamId, user.userId, id, dto.sourceId, dto.revision);
    }
    @Post(':id/source/unlink')
    @TeamRole('writable')
    unlink(
        @Param('teamId') teamId: string,
        @Param('id') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: SourceLinkDto,
    ) {
        return this.service.unlink(teamId, user.userId, id, dto.sourceId, dto.revision);
    }
}
