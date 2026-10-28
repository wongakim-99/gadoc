import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { ChannelModule } from '../channel/channel.module';
import { DocumentModule } from '../document/document.module';
import { MessageModule } from '../message/message.module';
import { PROJECT_REPOSITORY } from './domain/project.port';
import { Project, ProjectSchema } from './infrastructure/project.schema';
import { ProjectRepository } from './infrastructure/project.repository';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

@Module({
    imports: [
        AuthModule,
        TeamModule,
        ChannelModule,
        DocumentModule,
        MessageModule,
        MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    ],
    controllers: [ProjectController],
    providers: [ProjectService, { provide: PROJECT_REPOSITORY, useClass: ProjectRepository }],
    exports: [ProjectService, PROJECT_REPOSITORY],
})
export class ProjectModule {}
