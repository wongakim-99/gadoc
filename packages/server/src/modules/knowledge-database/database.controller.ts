import { ContentChangeInterceptor } from '../../shared/interceptors/content-change.interceptor';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TeamRole } from '../../shared/decorators/team-role.decorator';
import {
    AddPropertyDto,
    CreateRowPageDto,
    CreateTemplateDto,
    ApplyTemplateDto,
    DefaultTemplateDto,
    RenameDatabaseDto,
    UpdateRowDto,
    DatabaseLockDto,
    DatabaseQueryDto,
    PropertyRevisionDto,
    AddRowDto,
    CreateDatabaseDto,
    UpdateCellDto,
    MentionRowDto,
    AddViewDto,
    RenamePropertyDto,
} from './database.dto';
import { DatabaseService } from './database.service';

@UseInterceptors(ContentChangeInterceptor)
@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/database')
export class DatabaseController {
    constructor(private readonly service: DatabaseService) {}
    @Post('issue-source')
    @TeamRole('writable')
    issueSource(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.service.provisionIssueSource(teamId, user.userId);
    }
    @Get()
    @TeamRole('member')
    list(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }) {
        return this.service.list(teamId, user.userId);
    }
    @Post()
    @TeamRole('writable')
    create(@Param('teamId') teamId: string, @CurrentUser() user: { userId: string }, @Body() dto: CreateDatabaseDto) {
        return this.service.create(teamId, user.userId, dto.name);
    }
    @Get('document/:documentId')
    @TeamRole('member')
    memberships(
        @Param('teamId') teamId: string,
        @Param('documentId') documentId: string,
        @CurrentUser() user: { userId: string },
    ) {
        return this.service.memberships(teamId, user.userId, documentId);
    }
    @Get(':databaseId')
    @TeamRole('member')
    read(@Param('teamId') teamId: string, @Param('databaseId') id: string, @CurrentUser() user: { userId: string },
        @Query('projectId') projectId?: string) {
        return this.service.read(teamId, user.userId, id, undefined, projectId);
    }
    @Post(':databaseId/query')
    @TeamRole('member')
    query(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: DatabaseQueryDto,
    ) {
        return this.service.query(teamId, user.userId, id, dto);
    }
    @Post(':databaseId/property')
    @TeamRole('writable')
    addProperty(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: AddPropertyDto,
    ) {
        return this.service.addProperty(teamId, user.userId, id, dto);
    }
    @Post(':databaseId/row')
    @TeamRole('writable')
    addRow(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: AddRowDto,
    ) {
        return this.service.addRow(teamId, user.userId, id, dto.documentId, dto.values);
    }
    @Post(':databaseId/row/page')
    @TeamRole('writable')
    createRowPage(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateRowPageDto,
    ) {
        return this.service.createRowPage(teamId, user.userId, id, dto.title, dto.creationId, dto.values, dto.projectId);
    }
    @Patch(':databaseId/row/:documentId')
    @TeamRole('writable')
    updateRow(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('documentId') documentId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: UpdateRowDto,
    ) {
        return this.service.updateCells(teamId, user.userId, id, documentId, dto.values, dto.revision);
    }
    @Patch(':databaseId/row/:documentId/:propertyId')
    @TeamRole('writable')
    update(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('documentId') documentId: string,
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: UpdateCellDto,
    ) {
        return this.service.updateCell(
            teamId,
            user.userId,
            id,
            documentId,
            propertyId,
            dto.value,
            dto.revision,
            dto.relationRevision,
        );
    }
    @Post(':databaseId/row/:documentId/mention')
    @TeamRole('writable')
    mention(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('documentId') documentId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: MentionRowDto,
    ) {
        return this.service.mention(teamId, user.userId, id, documentId, dto.recipientIds);
    }
    @Post(':databaseId/view')
    @TeamRole('writable')
    addView(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: AddViewDto,
    ) {
        return this.service.addView(teamId, user.userId, id, dto);
    }
    @Patch(':databaseId/property/:propertyId')
    @TeamRole('writable')
    renameProperty(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: RenamePropertyDto,
    ) {
        return this.service.renameProperty(teamId, user.userId, id, propertyId, dto);
    }
    @Patch(':databaseId/property/:propertyId/configuration')
    @TeamRole('writable')
    configureProperty(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: AddPropertyDto,
    ) {
        return this.service.configureProperty(teamId, user.userId, id, propertyId, dto);
    }
    @Post(':databaseId/property/:propertyId/archive')
    @TeamRole('writable')
    archiveProperty(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: PropertyRevisionDto,
    ) {
        return this.service.archiveProperty(teamId, user.userId, id, propertyId, true, dto.revision);
    }
    @Post(':databaseId/property/:propertyId/restore')
    @TeamRole('writable')
    restoreProperty(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: PropertyRevisionDto,
    ) {
        return this.service.archiveProperty(teamId, user.userId, id, propertyId, false, dto.revision);
    }
    @Patch(':databaseId/lock')
    @TeamRole('writable')
    lock(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: DatabaseLockDto,
    ) {
        return this.service.setLock(teamId, user.userId, id, dto.locked, dto.revision);
    }
    @Patch(':databaseId/default-template')
    @TeamRole('writable')
    setDefaultTemplate(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: DefaultTemplateDto,
    ) {
        return this.service.setDefaultTemplate(teamId, user.userId, id, dto.templateId ?? null, dto.revision);
    }
    @Patch(':databaseId')
    @TeamRole('writable')
    renameDatabase(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: RenameDatabaseDto,
    ) {
        return this.service.renameDatabase(teamId, user.userId, id, dto.name, dto.revision);
    }
    @Patch(':databaseId/view/:viewId')
    @TeamRole('writable')
    updateView(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('viewId') viewId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: AddViewDto,
    ) {
        return this.service.addView(teamId, user.userId, id, dto, viewId);
    }
    @Post(':databaseId/view/:viewId/remove')
    @TeamRole('writable')
    removeView(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('viewId') viewId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: PropertyRevisionDto,
    ) {
        return this.service.removeView(teamId, user.userId, id, viewId, dto.revision);
    }
    @Post(':databaseId/template')
    @TeamRole('writable')
    createTemplate(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateTemplateDto,
    ) {
        return this.service.createTemplate(teamId, user.userId, id, dto.name, dto.creationId, dto.revision);
    }
    @Post(':databaseId/template/:templateId/page')
    @TeamRole('writable')
    applyTemplate(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('templateId') templateId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: ApplyTemplateDto,
    ) {
        return this.service.applyTemplate(teamId, user.userId, id, templateId, dto.creationId);
    }
    @Post(':databaseId/row/:documentId/duplicate')
    @TeamRole('writable')
    duplicateRow(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('documentId') documentId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: ApplyTemplateDto,
    ) {
        return this.service.duplicateRow(teamId, user.userId, id, documentId, dto.creationId);
    }
    @Post(':databaseId/template/:templateId/remove')
    @TeamRole('writable')
    removeTemplate(
        @Param('teamId') teamId: string,
        @Param('databaseId') id: string,
        @Param('templateId') templateId: string,
        @CurrentUser() user: { userId: string },
        @Body() dto: PropertyRevisionDto,
    ) {
        return this.service.removeTemplate(teamId, user.userId, id, templateId, dto.revision);
    }
}
