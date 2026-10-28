import { Module } from '@nestjs/common';
import { NOTIFICATION_PUBLISHER } from './application/ports/notification-publisher.port';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './infrastructure/persistence/notification.schema';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';
import { NOTIFICATION_REPOSITORY } from './domain/notification.port';
import { CreateNotificationUseCase } from './application/use-cases/create-notification.use-case';
import { GetNotificationsUseCase } from './application/use-cases/get-notifications.use-case';
import { GetUnreadNotificationCountUseCase } from './application/use-cases/get-unread-notification-count.use-case';
import { MarkNotificationAsReadUseCase } from './application/use-cases/mark-notification-as-read.use-case';
import { MarkAllNotificationsAsReadUseCase } from './application/use-cases/mark-all-notifications-as-read.use-case';
import { NotificationController } from './infrastructure/http/notification.controller';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { MessageModule } from '../message/message.module';
import { ChannelModule } from '../channel/channel.module';
import { DocumentModule } from '../document/document.module';
import { Issue, IssueSchema } from '../issue/infrastructure/persistence/issue.schema';
import { NotificationResourceService } from './application/services/notification-resource.service';
import {
    NotificationPreference,
    NotificationPreferenceSchema,
} from './infrastructure/persistence/notification-preference.schema';
import { NotificationPreferenceService } from './application/services/notification-preference.service';
import { NotificationPreferenceController } from './infrastructure/http/notification-preference.controller';
import { NotificationGateway } from './infrastructure/websocket/notification.gateway';
import { NotificationEventListener } from './application/listeners/notification-event.listener';
import {
    NotificationDelivery,
    NotificationDeliverySchema,
    NotificationDeliveryController,
    NotificationDeliveryService,
} from './infrastructure/http/notification-delivery.controller';

@Module({
    imports: [
        AuthModule,
        TeamModule,
        MessageModule,
        ChannelModule,
        DocumentModule,
        MongooseModule.forFeature([
            { name: Issue.name, schema: IssueSchema },
            { name: Notification.name, schema: NotificationSchema },
            { name: NotificationDelivery.name, schema: NotificationDeliverySchema },
            { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
        ]),
    ],
    controllers: [NotificationController, NotificationDeliveryController, NotificationPreferenceController],
    providers: [
        { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
        CreateNotificationUseCase,
        GetNotificationsUseCase,
        GetUnreadNotificationCountUseCase,
        MarkNotificationAsReadUseCase,
        MarkAllNotificationsAsReadUseCase,
        NotificationGateway,
        { provide: NOTIFICATION_PUBLISHER, useExisting: NotificationGateway },
        NotificationEventListener,
        NotificationDeliveryService,
        NotificationPreferenceService,
        NotificationResourceService,
    ],
})
export class NotificationModule {}
