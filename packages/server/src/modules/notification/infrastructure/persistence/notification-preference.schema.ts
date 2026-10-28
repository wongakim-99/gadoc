import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
    DEFAULT_NOTIFICATION_KINDS,
    type NotificationMode,
    type NotificationKinds,
    type NotificationKindOverrides,
} from '../../domain/notification-preference';

@Schema({ timestamps: true, collection: 'notification_preferences', versionKey: false })
export class NotificationPreference {
    @Prop({ type: String }) _id: string;
    @Prop({ required: true }) teamId: string;
    @Prop({ required: true }) userId: string;
    @Prop({ type: String, enum: ['all', 'mentions', 'off'], default: 'all' }) mode: NotificationMode;
    @Prop({ type: Object, default: {} }) channelModes: Record<string, NotificationMode>;
    @Prop({ type: Object, default: () => ({ ...DEFAULT_NOTIFICATION_KINDS }) }) kinds: NotificationKinds;
    @Prop({ type: Object, default: {} }) channelKinds: Record<string, NotificationKindOverrides>;
    @Prop({ default: 0 }) revision: number;
}
export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);
