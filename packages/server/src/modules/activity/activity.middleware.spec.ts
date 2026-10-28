import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { ActivityMiddleware } from './activity.middleware';
import { ActivityService } from './activity.service';
import type { ActivityRequest } from './activity-event';

describe('응답 종료 기반 사용자 활동 기록', () => {
    beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    function setup(path = '/api/team/invite/secret-code/join') {
        const service = { record: jest.fn(), fingerprint: jest.fn().mockReturnValue('hashed-email') };
        const middleware = new ActivityMiddleware(service as unknown as ActivityService);
        const req = {
            method: 'POST',
            path,
            body: { email: 'private@example.test', password: 'private-password' },
            headers: { authorization: 'Bearer private-token', 'x-request-id': 'forged-id' },
        } as unknown as ActivityRequest;
        const res = Object.assign(new EventEmitter(), {
            statusCode: 201,
            writableFinished: false,
            setHeader: jest.fn(),
        });
        const next = jest.fn();
        middleware.use(req, res as unknown as Response, next);
        return { req, res, service, next };
    }

    it.each([401, 403, 429, 500])('가드 또는 예외에서 반환된 %s도 한 번만 기록한다', (statusCode) => {
        const { req, res, service, next } = setup();
        res.statusCode = statusCode;
        req.user = { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa' };
        res.writableFinished = true;
        res.emit('finish');
        res.emit('close');
        expect(next).toHaveBeenCalledTimes(1);
        expect(service.record).toHaveBeenCalledTimes(1);
        const event = service.record.mock.calls[0][0];
        expect(event).toMatchObject({
            actorId: req.user.userId,
            outcome: 'failure',
            statusCode,
            route: '/api/team/invite/:code/join',
        });
        expect(JSON.stringify(event)).not.toMatch(/private-|secret-code|forged-id/);
        expect(event.requestId).toMatch(/^[a-f\d-]{36}$/);
        expect(res.listenerCount('close')).toBe(0);
    });

    it('성공 응답 뒤의 close를 중복 실패로 기록하지 않는다', () => {
        const { res, service } = setup();
        res.writableFinished = true;
        res.emit('finish');
        res.emit('close');
        expect(service.record.mock.calls[0][0]).toMatchObject({ outcome: 'success', reason: 'completed' });
        expect(service.record).toHaveBeenCalledTimes(1);
    });

    it('응답 완료 전에 연결이 끊기면 499로 기록한다', () => {
        const { res, service } = setup();
        res.emit('close');
        expect(service.record.mock.calls[0][0]).toMatchObject({ outcome: 'aborted', statusCode: 499 });
    });

    it('로그인 시도는 이메일 원문 대신 별도 식별값으로 연결한다', () => {
        const { res, service } = setup('/api/auth/login');
        res.emit('finish');
        expect(service.fingerprint).toHaveBeenCalledWith('private@example.test');
        expect(service.record.mock.calls[0][0].subjectFingerprint).toBe('hashed-email');
        expect(JSON.stringify(service.record.mock.calls[0][0])).not.toContain('private@example.test');
    });
});
