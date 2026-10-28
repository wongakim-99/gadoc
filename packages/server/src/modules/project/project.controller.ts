import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
    IsArray,
    IsInt,
    IsMongoId,
    IsString,
    MaxLength,
    Min,
    ArrayMaxSize,
    ArrayUnique,
    ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../shared/decorators/team-role.decorator';
import { ProjectService } from './project.service';

class ProjectFieldsDto {
    @IsString() @MaxLength(80) name: string;
    @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsMongoId({ each: true }) channelIds: string[];
    @ValidateIf((_, value) => value !== null) @IsMongoId() documentId: string | null;
}
class UpdateProjectDto extends ProjectFieldsDto {
    @IsInt() @Min(0) revision: number;
}

@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/project')
export class ProjectController {
    constructor(private readonly service: ProjectService) {}
    @Get()
    @TeamRole('member')
    list(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.service.list(teamId, user.userId);
    }
    @Post()
    @TeamRole('admin')
    create(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }, @Body() dto: ProjectFieldsDto) {
        return this.service.create(teamId, user.userId, dto);
    }
    @Patch(':projectId')
    @TeamRole('admin')
    update(
        @Param('teamId') teamId: string,
        @Param('projectId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: UpdateProjectDto,
    ) {
        return this.service.update(teamId, user.userId, id, dto.revision, dto);
    }
}
