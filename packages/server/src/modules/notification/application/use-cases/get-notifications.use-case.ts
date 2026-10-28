import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification.port';
import { NotificationResourceService } from '../services/notification-resource.service';

@Injectable()
export class GetNotificationsUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository,
        private readonly resources: NotificationResourceService,
    ) {}

    async execute(teamId: string, recipientId: string, limit = 50) {
        const notices = await this.repo.findByRecipient(teamId, recipientId, limit);
        return this.resources.filterVisible(teamId, recipientId, notices);
    }
}
