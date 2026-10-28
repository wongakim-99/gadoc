import { Issue, IssueSchema } from '../issue/infrastructure/persistence/issue.schema';
import { IssueSourceService } from './issue-source.service';
import { ProjectModule } from '../project/project.module';
import { DatabaseContainer, DatabaseContainerSchema } from './container.schema';
import { DatabaseContainerService } from './container.service';
import { DatabaseContainerController } from './container.controller';
import { DatabaseGateway } from './database.gateway';
import { ContentChangeInterceptor } from '../../shared/interceptors/content-change.interceptor';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { DocumentModule } from '../document/document.module';
import { KnowledgeDatabase, KnowledgeDatabaseSchema, DatabaseRow, DatabaseRowSchema } from './database.schema';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
@Module({
    imports: [
        ProjectModule,
        AuthModule,
        TeamModule,
        DocumentModule,
        MongooseModule.forFeature([
            { name: Issue.name, schema: IssueSchema },
            { name: DatabaseContainer.name, schema: DatabaseContainerSchema },
            { name: KnowledgeDatabase.name, schema: KnowledgeDatabaseSchema },
            { name: DatabaseRow.name, schema: DatabaseRowSchema },
        ]),
    ],
    controllers: [DatabaseController, DatabaseContainerController],
    providers: [
        IssueSourceService,
        DatabaseContainerService,
        DatabaseService,
        DatabaseGateway,
        ContentChangeInterceptor,
    ],
    exports: [DatabaseService, DatabaseContainerService],
})
export class DatabaseModule {}
