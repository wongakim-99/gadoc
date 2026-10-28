import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileGateway } from './profile.gateway';

@Module({
    imports: [AuthModule, TeamModule, StorageModule],
    controllers: [ProfileController],
    providers: [ProfileService, ProfileGateway],
})
export class ProfileModule {}
