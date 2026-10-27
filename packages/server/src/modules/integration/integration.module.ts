import { Module } from '@nestjs/common';
import { TeamModule } from '../team/team.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentModule } from '../document/document.module';
import { DatabaseModule } from '../knowledge-database/database.module';
import { IntegrationTokenService } from './integration-token.service';
import { IntegrationController } from './integration.controller';
import { McpDocumentService } from './mcp-document.service';
import { McpServerService } from './mcp-server.service';
import { McpController } from './mcp.controller';

@Module({
    imports: [AuthModule, TeamModule, DocumentModule, DatabaseModule],
    controllers: [IntegrationController, McpController],
    providers: [IntegrationTokenService, McpDocumentService, McpServerService],
})
export class IntegrationModule {}
