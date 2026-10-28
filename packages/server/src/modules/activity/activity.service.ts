import { BadRequestException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'node:crypto';
import { Model } from 'mongoose';
import { jwtSecret } from '../../shared/lib/security-config';
import { Team, type TeamDocument } from '../team/infrastructure/persistence/team.schema';
import { ACTIVITY_RETENTION_DAYS, objectId, type ActivityEvent, type ActivityRoute } from './activity-event';
import { UserActivityEvent } from './activity.schema';

@Injectable()
export class ActivityService implements OnModuleDestroy {
    private readonly logger = new Logger('UserActivity');
    private readonly pending = new Set<Promise<void>>();
    private readonly fingerprintKey: string;

    constructor(
        @InjectModel(UserActivityEvent.name) private readonly events: Model<UserActivityEvent>,
        @InjectModel(Team.name) private readonly teams: Model<TeamDocument>,
        config: ConfigService,
    ) {
        this.fingerprintKey = jwtSecret(config.get<string>('JWT_SECRET'));
    }

    fingerprint(email: unknown): string | null {
        if (typeof email !== 'string' || email.length > 254 || !email.includes('@')) return null;
        return createHmac('sha256', this.fingerprintKey)
            .update(`user-activity:v1:${email.trim().toLowerCase()}`)
            .digest('hex');
    }

    record(event: ActivityEvent, route: ActivityRoute): void {
        // DB 장애나 공격성 요청이 로그인 처리와 메모리를 막지 않도록 동시 저장 수를 제한한다.
        this.logger.log(JSON.stringify(event));
        if (this.pending.size >= 200) {
            this.logger.warn(JSON.stringify({ event: 'activity_storage_busy', requestId: event.requestId }));
            return;
        }
        const pending = this.persist(event, route)
            .catch(() => {
                this.logger.error(JSON.stringify({ event: 'activity_storage_failed', requestId: event.requestId }));
            })
            .finally(() => this.pending.delete(pending));
        this.pending.add(pending);
    }

    private async persist(event: ActivityEvent, route: ActivityRoute): Promise<void> {
        if (!event.teamId && (route.slug || route.inviteCode)) {
            const filter = route.slug ? { slug: route.slug } : { 'inviteLinks.code': route.inviteCode };
            const team = await this.teams.findOne(filter).select({ _id: 1 }).maxTimeMS(2000).lean();
            event = { ...event, teamId: team ? String(team._id) : null };
        }
        await this.events.create(event);
    }

    async list(teamId: string, query: { actorId?: string; before?: string; limit?: string }) {
        if (!objectId(teamId)) throw new BadRequestException('올바른 워크스페이스 ID가 필요합니다.');
        if (query.actorId !== undefined && !objectId(query.actorId)) {
            throw new BadRequestException('올바른 사용자 ID가 필요합니다.');
        }
        if (query.before !== undefined && !objectId(query.before)) {
            throw new BadRequestException('올바른 페이지 커서가 필요합니다.');
        }
        const limit = query.limit === undefined ? 50 : Number(query.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw new BadRequestException('조회 수는 1~100이어야 합니다.');
        }
        const rows = await this.events
            .find({
                teamId,
                ...(query.actorId ? { actorId: query.actorId } : {}),
                ...(query.before ? { _id: { $lt: query.before } } : {}),
                createdAt: { $gte: new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86400_000) },
            })
            .select({ subjectFingerprint: 0 })
            .sort({ _id: -1 })
            .limit(limit + 1)
            .maxTimeMS(2000)
            .lean();
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit);
        return { items, nextCursor: hasMore ? String(items.at(-1)?._id) : null };
    }

    async onModuleDestroy() {
        await Promise.allSettled(this.pending);
    }
}
