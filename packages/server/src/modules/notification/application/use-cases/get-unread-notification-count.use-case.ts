import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/notification.port';
import { NotificationResourceService } from '../services/notification-resource.service';

@Injectable()
export class GetUnreadNotificationCountUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository,
        private readonly resources: NotificationResourceService,
    ) {}

    async execute(teamId: string, recipientId: string) {
        const notices = await this.repo.findUnreadByRecipient(teamId, recipientId);
        return (await this.resources.filterVisible(teamId, recipientId, notices)).length;
    }
}
