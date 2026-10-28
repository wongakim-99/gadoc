import {
    Controller,
    ExecutionContext,
    HttpException,
    Injectable,
    Logger,
    Post,
    UseGuards,
    type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ActivityMiddleware } from './activity.middleware';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';
import { ResponseInterceptor } from '../../shared/interceptors/response.interceptor';
import { DiscordErrorFilter } from '../../shared/filters/discord-error.filter';
import { DiscordNotifyService } from '../discord/discord-notify.service';
import type { ActivityEvent } from './activity-event';

const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teamId = 'bbbbbbbbbbbbbbbbbbbbbbbb';

@Injectable()
class ProbeGuard {
    canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        if (req.headers['x-probe-status']) {
            const status = Number(req.headers['x-probe-status']);
            if (status === 403) req.user = { userId };
            throw new HttpException('probe-private-error', status);
        }
        return true;
    }
}

@Controller()
@UseGuards(ProbeGuard)
class ProbeController {
    @Post('auth/register') register() {
        return { id: userId, email: 'private@example.test' };
    }
    @Post('auth/login') login() {
        return { accessToken: 'private-token', user: { id: userId } };
    }
    @Post('team/invite/:code/join') join() {
        return { id: teamId };
    }
}

describe('실제 HTTP 응답과 사용자 활동 로그 연결', () => {
    let app: INestApplication;
    const events: ActivityEvent[] = [];
    const service = {
        record: jest.fn((event: ActivityEvent) => events.push(event)),
        fingerprint: jest.fn(() => 'hmac-only'),
    };
    const discord = { notifyError: jest.fn().mockResolvedValue(undefined) };

    beforeAll(async () => {
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        const module = await Test.createTestingModule({
            controllers: [ProbeController],
            providers: [ProbeGuard],
        }).compile();
        app = module.createNestApplication({ logger: false });
        const middleware = new ActivityMiddleware(service as unknown as ActivityService);
        app.use(middleware.use.bind(middleware));
        app.setGlobalPrefix('api');
        app.useGlobalInterceptors(new ActivityInterceptor(), new ResponseInterceptor());
        app.useGlobalFilters(new DiscordErrorFilter(discord as unknown as DiscordNotifyService));
        await app.init();
    });

    beforeEach(() => {
        events.length = 0;
        jest.clearAllMocks();
    });
    afterAll(async () => {
        await app.close();
        jest.restoreAllMocks();
    });

    it('회원가입 성공과 로그인 성공을 실제 사용자 ID 및 응답 요청 ID로 연결한다', async () => {
        for (const path of ['register', 'login']) {
            const result = await request(app.getHttpServer())
                .post(`/api/auth/${path}`)
                .send({ email: 'private@example.test', password: 'private-password' })
                .expect(201);
            expect(events.at(-1)).toMatchObject({
                actorId: userId,
                requestId: result.headers['x-request-id'],
                action: `auth.${path}`,
                statusCode: 201,
                outcome: 'success',
            });
        }
        expect(JSON.stringify(events)).not.toMatch(/private-password|private-token|private@example/);
    });

    it.each([400, 401, 403, 429, 500])('인터셉터 전 가드 거절 %s도 기록한다', async (status) => {
        const result = await request(app.getHttpServer())
            .post('/api/team/invite/private-code/join')
            .set('x-probe-status', String(status))
            .send({ password: 'private-password' })
            .expect(status);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            statusCode: status,
            outcome: 'failure',
            actorId: status === 403 ? userId : null,
            requestId: result.headers['x-request-id'],
        });
        expect(result.body.requestId).toBe(result.headers['x-request-id']);
        expect(JSON.stringify(events)).not.toMatch(/private-code|private-password|probe-private-error/);
        if (status === 500) {
            expect(discord.notifyError).toHaveBeenCalledTimes(1);
            expect(JSON.stringify(discord.notifyError.mock.calls)).not.toMatch(/private-code|probe-private-error/);
        }
    });

    it('초대 참여 성공의 응답 래핑 후에도 팀 ID를 유지한다', async () => {
        await request(app.getHttpServer()).post('/api/team/invite/private-code/join').expect(201);
        expect(events[0]).toMatchObject({ teamId, action: 'workspace.invite.join', outcome: 'success' });
    });
});
