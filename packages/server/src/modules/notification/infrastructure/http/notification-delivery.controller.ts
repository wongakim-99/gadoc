import { Body, Controller, Injectable, Post, Param, UseGuards } from '@nestjs/common';
import { Prop, Schema, SchemaFactory, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import { Matches } from 'class-validator';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { TeamAccessService } from '../../../team/application/services/team-access.service';
import { NotificationPreferenceService } from '../../application/services/notification-preference.service';

@Schema({ collection: 'notification_deliveries', versionKey: false })
export class NotificationDelivery {
    @Prop({ type: String }) _id: string;
    @Prop({ required: true, expires: 0 }) expiresAt: Date;
}
export const NotificationDeliverySchema = SchemaFactory.createForClass(NotificationDelivery);

export class ClaimNotificationDto {
    @Matches(/^(message|notification):[a-f0-9]{24}$/) key: string;
}

@Injectable()
export class NotificationDeliveryService {
    constructor(@InjectModel(NotificationDelivery.name) private readonly model: Model<NotificationDelivery>) {}
    async claim(teamId: string, userId: string, key: string) {
        const id = createHash('sha256').update(`${teamId}:${userId}:${key}`).digest('hex');
        try {
            // The unique _id makes races across tabs, Electron and server workers atomic.
            await this.model.create({ _id: id, expiresAt: new Date(Date.now() + 120_000) });
            return { deliver: true };
        } catch (error) {
            if ((error as { code?: number }).code === 11000) return { deliver: false };
            throw error;
        }
    }
}

@UseGuards(JwtAuthGuard)
@Controller('team/:teamId/notification/delivery-claim')
export class NotificationDeliveryController {
    constructor(
        private readonly deliveries: NotificationDeliveryService,
        private readonly teams: TeamAccessService,
        private readonly preferences: NotificationPreferenceService,
    ) {}
    @Post()
    async claim(
        @Param('teamId') teamId: string,
        @CurrentUser() user: { userId: string },
        @Body() input: ClaimNotificationDto,
    ) {
        await this.teams.requireMember(teamId, user.userId);
        const key = await this.preferences.deliveryKey(teamId, user.userId, input.key);
        if (!key) return { deliver: false };
        return this.deliveries.claim(teamId, user.userId, key);
    }
}
