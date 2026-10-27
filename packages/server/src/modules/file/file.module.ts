import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { MessageModule } from '../message/message.module';
import { DocumentModule } from '../document/document.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { FileAccessService } from './file-access.service';
import { FileController } from './file.controller';
import { LegacyFileBindingsService } from './legacy-file-bindings.service';

@Module({
    imports: [AuthModule, TeamModule, MessageModule, DocumentModule, StorageModule],
    providers: [FileAccessService, LegacyFileBindingsService],
    controllers: [FileController],
})
export class FileModule {}
