import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { Issue, IssueSchema } from './infrastructure/persistence/issue.schema';
import { IssueRepository } from './infrastructure/persistence/issue.repository';
import { ISSUE_REPOSITORY } from './domain/issue.port';
import { CreateIssueUseCase } from './application/use-cases/create-issue.use-case';
import { UpdateIssueUseCase } from './application/use-cases/update-issue.use-case';
import { GetIssuesUseCase } from './application/use-cases/get-issues.use-case';
import { DeleteIssueUseCase } from './application/use-cases/delete-issue.use-case';
import { IssueNotificationService } from './application/services/issue-notification.service';
import { IssueController } from './infrastructure/http/issue.controller';
import { IssueLinksService } from './application/services/issue-links.service';
import { DocumentModule } from '../document/document.module';
import { MessageModule } from '../message/message.module';
import { ChannelModule } from '../channel/channel.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Issue.name, schema: IssueSchema }]),
        AuthModule,
        TeamModule,
        DocumentModule,
        MessageModule,
        ChannelModule,
    ],
    controllers: [IssueController],
    providers: [
        IssueLinksService,
        { provide: ISSUE_REPOSITORY, useClass: IssueRepository },
        CreateIssueUseCase,
        UpdateIssueUseCase,
        GetIssuesUseCase,
        DeleteIssueUseCase,
        IssueNotificationService,
    ],
})
export class IssueModule {}
