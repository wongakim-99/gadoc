import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ACTIVITY_RETENTION_DAYS, type ActivityEvent } from './activity-event';

/** 사용자 동작만 분리 보관하며 요청 본문과 인증 정보는 저장하지 않는다. */
@Schema({ collection: 'user_activity_events', versionKey: false, bufferCommands: false })
export class UserActivityEvent implements ActivityEvent {
    @Prop({ required: true }) requestId: string;
    @Prop({ required: true }) action: string;
    @Prop({ required: true }) method: string;
    @Prop({ required: true }) route: string;
    @Prop({ type: String, default: null }) actorId: string | null;
    @Prop({ type: String, default: null }) subjectFingerprint: string | null;
    @Prop({ type: String, default: null }) teamId: string | null;
    @Prop({ required: true }) statusCode: number;
    @Prop({ type: String, required: true, enum: ['success', 'failure', 'aborted'] }) outcome: ActivityEvent['outcome'];
    @Prop({ required: true }) reason: string;
    @Prop({ required: true }) durationMs: number;
    @Prop({ type: Date, required: true }) createdAt: Date;
}

export const UserActivityEventSchema = SchemaFactory.createForClass(UserActivityEvent);
UserActivityEventSchema.index({ requestId: 1 }, { unique: true });
UserActivityEventSchema.index({ teamId: 1, _id: -1 });
UserActivityEventSchema.index({ actorId: 1, createdAt: -1 });
UserActivityEventSchema.index({ subjectFingerprint: 1, createdAt: -1 });
UserActivityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_RETENTION_DAYS * 86400 });
