import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import { TeamAccessService } from '../../../team/application/services/team-access.service';
import { CHANNEL_REPOSITORY, type IChannelRepository } from '../../../channel/domain/channel.port';
import { NotificationResourceService } from './notification-resource.service';
import { NotificationPreference } from '../../infrastructure/persistence/notification-preference.schema';
import { Notification } from '../../infrastructure/persistence/notification.schema';
import {
    notificationAllowed,
    notificationModeFor,
    notificationKindEnabled,
    channelVisibleForNotifications,
    DEFAULT_NOTIFICATION_KINDS,
    NOTIFICATION_KINDS,
    type UpdateNotificationPreference,
    type NotificationPreferenceValue,
} from '../../domain/notification-preference';

@Injectable()
export class NotificationPreferenceService {
    constructor(
        @InjectModel(NotificationPreference.name) private readonly model: Model<NotificationPreference>,
        @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
        private readonly teams: TeamAccessService,
        @Inject(CHANNEL_REPOSITORY) private readonly channels: IChannelRepository,
        private readonly resources: NotificationResourceService,
    ) {}

    private id(teamId: string, userId: string) {
        return createHash('sha256').update(`${teamId}:${userId}`).digest('hex');
    }
    private async raw(teamId: string, userId: string): Promise<NotificationPreferenceValue> {
        const value = await this.model.findById(this.id(teamId, userId)).lean();
        return {
            mode: value?.mode ?? 'all',
            channelModes: value?.channelModes ?? {},
            kinds: { ...DEFAULT_NOTIFICATION_KINDS, ...value?.kinds },
            channelKinds: value?.channelKinds ?? {},
            revision: value?.revision ?? 0,
        };
    }
    async get(teamId: string, userId: string) {
        await this.teams.requireMember(teamId, userId);
        const [value, channels] = await Promise.all([this.raw(teamId, userId), this.channels.findByTeam(teamId)]);
        const visible = new Set(
            channels
                .filter((channel) => channelVisibleForNotifications(channel, teamId, userId))
                .map((channel) => channel.id),
        );
        return {
            ...value,
            channelModes: Object.fromEntries(Object.entries(value.channelModes).filter(([id]) => visible.has(id))),
            channelKinds: Object.fromEntries(Object.entries(value.channelKinds).filter(([id]) => visible.has(id))),
        };
    }
    async update(teamId: string, userId: string, input: UpdateNotificationPreference) {
        await this.teams.requireMember(teamId, userId);
        if (
            !input ||
            (input.mode !== undefined && !['all', 'mentions', 'off', 'inherit'].includes(input.mode)) ||
            !Number.isSafeInteger(input.revision) ||
            input.revision < 0 ||
            input.revision >= Number.MAX_SAFE_INTEGER ||
            (input.reset !== undefined && typeof input.reset !== 'boolean') ||
            (input.mode === undefined && input.kinds === undefined && !input.reset)
        )
            throw new BadRequestException('알림 설정을 확인해 주세요.');
        if (input.channelId !== undefined) {
            if (typeof input.channelId !== 'string' || !/^[a-f0-9]{24}$/.test(input.channelId))
                throw new BadRequestException('채널을 확인해 주세요.');
            const channel = await this.channels.findById(input.channelId);
            if (!channel || !channelVisibleForNotifications(channel, teamId, userId))
                throw new NotFoundException('채널에 접근할 수 없습니다.');
        } else if (input.mode === 'inherit') throw new BadRequestException('워크스페이스 기본 정책을 선택해 주세요.');
        if (input.reset && (!input.channelId || input.mode !== undefined || input.kinds !== undefined))
            throw new BadRequestException('초기화할 채팅방을 확인해 주세요.');
        if (
            input.kinds !== undefined &&
            (!input.kinds ||
                typeof input.kinds !== 'object' ||
                Array.isArray(input.kinds) ||
                !Object.keys(input.kinds).length ||
                Object.entries(input.kinds).some(
                    ([kind, enabled]) =>
                        !NOTIFICATION_KINDS.includes(kind as (typeof NOTIFICATION_KINDS)[number]) ||
                        (typeof enabled !== 'boolean' && !(input.channelId && enabled === 'inherit')),
                ))
        )
            throw new BadRequestException('알림 종류별 설정을 확인해 주세요.');
        const current = await this.raw(teamId, userId);
        if (current.revision !== input.revision) throw this.conflict();
        const channelModes = { ...current.channelModes };
        const channelKinds = { ...current.channelKinds };
        const kinds = { ...current.kinds };
        if (input.channelId) {
            if (input.reset || input.mode === 'inherit') delete channelModes[input.channelId];
            else if (input.mode !== undefined) channelModes[input.channelId] = input.mode;
            if (input.reset) delete channelKinds[input.channelId];
            else if (input.kinds) {
                const overrides = { ...channelKinds[input.channelId] };
                for (const kind of NOTIFICATION_KINDS) {
                    const enabled = input.kinds[kind];
                    if (enabled === 'inherit') delete overrides[kind];
                    else if (typeof enabled === 'boolean') overrides[kind] = enabled;
                }
                if (Object.keys(overrides).length) channelKinds[input.channelId] = overrides;
                else delete channelKinds[input.channelId];
            }
        } else {
            for (const kind of NOTIFICATION_KINDS) {
                const enabled = input.kinds?.[kind];
                if (typeof enabled === 'boolean') kinds[kind] = enabled;
            }
        }
        if (new Set([...Object.keys(channelModes), ...Object.keys(channelKinds)]).size > 500)
            throw new BadRequestException('채널별 설정은 최대 500개입니다.');
        try {
            const saved = await this.model
                .findOneAndUpdate(
                    { _id: this.id(teamId, userId), revision: current.revision },
                    {
                        $set: {
                            teamId,
                            userId,
                            mode: input.channelId ? current.mode : (input.mode ?? current.mode),
                            channelModes,
                            kinds,
                            channelKinds,
                        },
                        $inc: { revision: 1 },
                    },
                    { returnDocument: 'after', upsert: current.revision === 0, setDefaultsOnInsert: true },
                )
                .lean();
            if (!saved) throw this.conflict();
        } catch (error) {
            if ((error as { code?: number }).code === 11000) throw this.conflict();
            throw error;
        }
        return this.get(teamId, userId);
    }
    private conflict() {
        return new ConflictException('다른 창에서 알림 설정이 바뀌었습니다. 최신 설정을 확인한 뒤 다시 저장해 주세요.');
    }

    // Gate both raw chat and inbox notifications before either client claims delivery.
    async shouldDeliver(teamId: string, userId: string, key: string) {
        return (await this.deliveryKey(teamId, userId, key)) !== null;
    }

    async deliveryKey(teamId: string, userId: string, key: string): Promise<string | null> {
        const { role } = await this.teams.requireMember(teamId, userId);
        const match = /^(message|notification):([a-f0-9]{24})$/.exec(key);
        if (!match) return null;
        let context;
        let canonicalKey = key;
        if (match[1] === 'message') {
            context = await this.resources.messageContext(teamId, userId, match[2]);
        } else {
            const notice = await this.notifications.findById(match[2]).lean();
            if (!notice) return null;
            context = await this.resources.notificationContext(teamId, userId, notice, role);
            if (notice.resourceType === 'message') canonicalKey = `message:${notice.resourceId}`;
        }
        if (!context) return null;
        const preference = await this.raw(teamId, userId);
        return notificationAllowed(notificationModeFor(preference, context.channelId), context.related) &&
            notificationKindEnabled(preference, context.kind, context.channelId)
            ? canonicalKey
            : null;
    }
}
