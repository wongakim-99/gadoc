import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamModule } from '../team/team.module';
import { AuthModule } from '../auth/auth.module';
import { Team, TeamSchema } from '../team/infrastructure/persistence/team.schema';
import { ActivityController } from './activity.controller';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityMiddleware } from './activity.middleware';
import { ActivityService } from './activity.service';
import { UserActivityEvent, UserActivityEventSchema } from './activity.schema';

@Module({
    imports: [
        ConfigModule,
        AuthModule,
        TeamModule,
        MongooseModule.forFeature([
            { name: UserActivityEvent.name, schema: UserActivityEventSchema },
            { name: Team.name, schema: TeamSchema },
        ]),
    ],
    controllers: [ActivityController],
    providers: [ActivityService, ActivityMiddleware, { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }],
    exports: [ActivityMiddleware],
})
export class ActivityModule {}
