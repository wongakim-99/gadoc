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
        AuthModule,
        TeamModule,
        DocumentModule,
        MongooseModule.forFeature([
            { name: DatabaseContainer.name, schema: DatabaseContainerSchema },
            { name: KnowledgeDatabase.name, schema: KnowledgeDatabaseSchema },
            { name: DatabaseRow.name, schema: DatabaseRowSchema },
        ]),
    ],
    controllers: [DatabaseController, DatabaseContainerController],
    providers: [DatabaseContainerService, DatabaseService, DatabaseGateway, ContentChangeInterceptor],
})
export class DatabaseModule {}
