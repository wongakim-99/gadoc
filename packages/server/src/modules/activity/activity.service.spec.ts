import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { TeamDocument } from '../team/infrastructure/persistence/team.schema';
import { ActivityService } from './activity.service';
import { UserActivityEvent, UserActivityEventSchema } from './activity.schema';
import type { ActivityEvent } from './activity-event';

describe('사용자 활동 저장과 보관 정책', () => {
    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    function setup() {
        const find = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maxTimeMS: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        };
        const teamQuery = {
            select: jest.fn().mockReturnThis(),
            maxTimeMS: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' }),
        };
        const events = { create: jest.fn().mockResolvedValue({}), find: jest.fn().mockReturnValue(find) };
        const teams = { findOne: jest.fn().mockReturnValue(teamQuery) };
        const config = { get: () => 'activity-test-secret-not-for-production-0123456789' };
        const service = new ActivityService(
            events as unknown as Model<UserActivityEvent>,
            teams as unknown as Model<TeamDocument>,
            config as unknown as ConfigService,
        );
        return { events, teams, find, service };
    }

    function event(): ActivityEvent {
        return {
            requestId: 'request-id',
            action: 'workspace.invite.join',
            method: 'POST',
            route: '/api/team/invite/:code/join',
            actorId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            teamId: null,
            subjectFingerprint: null,
            statusCode: 403,
            outcome: 'failure',
            reason: 'permission_denied',
            durationMs: 10,
            createdAt: new Date(),
        };
    }

    it('초대 실패의 팀을 조회하되 저장 데이터에 초대 코드는 넣지 않는다', async () => {
        const { service, events, teams } = setup();
        service.record(event(), {
            action: 'workspace.invite.join',
            route: '/api/team/invite/:code/join',
            inviteCode: 'private-code',
        });
        await service.onModuleDestroy();
        expect(teams.findOne).toHaveBeenCalledWith({ 'inviteLinks.code': 'private-code' });
        expect(events.create).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }));
        expect(JSON.stringify(events.create.mock.calls)).not.toContain('private-code');
    });

    it('저장 실패를 숨기지 않으며 요청 본문이나 DB 오류 원문은 로그에 남기지 않는다', async () => {
        const { service, events } = setup();
        events.create.mockRejectedValue(new Error('database-private-key'));
        service.record(
            { ...event(), teamId: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
            { action: 'workspace.join', route: '/api/team/:slug/join' },
        );
        await service.onModuleDestroy();
        expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('activity_storage_failed'));
        expect(JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls)).not.toContain('database-private-key');
    });

    it('이메일 식별값은 정규화되고 서명 비밀 없이는 단순 해시로 대조할 수 없다', () => {
        const { service } = setup();
        expect(service.fingerprint(' Person@Example.test ')).toBe(service.fingerprint('person@example.test'));
        expect(service.fingerprint('person@example.test')).toMatch(/^[a-f\d]{64}$/);
        expect(service.fingerprint({ email: 'person@example.test' })).toBeNull();
    });

    it('팀 조회는 범위와 보관 기간으로 제한하고 이메일 식별값은 공개하지 않는다', async () => {
        const { service, events, find } = setup();
        await service.list('bbbbbbbbbbbbbbbbbbbbbbbb', { actorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', limit: '20' });
        expect(events.find).toHaveBeenCalledWith(
            expect.objectContaining({
                teamId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
                actorId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
                createdAt: { $gte: expect.any(Date) },
            }),
        );
        expect(find.select).toHaveBeenCalledWith({ subjectFingerprint: 0 });
        expect(find.limit).toHaveBeenCalledWith(21);
    });

    it.each([{ limit: '101' }, { limit: '-1' }, { actorId: 'not-an-id' }, { before: 'secret' }])(
        '잘못된 조회 조건 %j를 거절한다',
        async (query) => {
            await expect(setup().service.list('bbbbbbbbbbbbbbbbbbbbbbbb', query)).rejects.toThrow();
        },
    );

    it('30일 TTL과 요청별 중복 방지 인덱스를 만든다', () => {
        expect(UserActivityEventSchema.indexes()).toEqual(
            expect.arrayContaining([
                [{ createdAt: 1 }, expect.objectContaining({ expireAfterSeconds: 2592000 })],
                [{ requestId: 1 }, expect.objectContaining({ unique: true })],
            ]),
        );
    });
});
