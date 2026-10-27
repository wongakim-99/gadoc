import { Controller, ForbiddenException, Get, UseGuards, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { TeamRole } from '../decorators/team-role.decorator';
import { TeamAccessGuard } from './team-access.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategy/jwt.strategy';
import { TeamAccessService } from '../../modules/team/application/services/team-access.service';

@Controller('team/:teamId/probe')
@UseGuards(JwtAuthGuard)
@TeamRole('member')
class ProbeController {
    @Get() get() {
        return { ok: true };
    }
}

describe('global team access and controller authentication order', () => {
    let app: INestApplication;
    const access = { requireMember: jest.fn() };
    const jwt = new JwtService({ secret: 'local-guard-regression-0123456789abcdef' });

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [ProbeController],
            providers: [
                JwtStrategy,
                { provide: ConfigService, useValue: { get: () => 'local-guard-regression-0123456789abcdef' } },
                { provide: TeamAccessService, useValue: access },
                { provide: APP_GUARD, useClass: TeamAccessGuard },
            ],
        }).compile();
        app = module.createNestApplication();
        app.use(cookieParser());
        await app.init();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(() => {
        access.requireMember.mockReset();
        access.requireMember.mockResolvedValue({});
    });

    it('authenticates a cookie before checking team membership', async () => {
        const token = jwt.sign({ sub: 'member', email: 'member@example.test' });
        await request(app.getHttpServer()).get('/team/team-1/probe').set('Cookie', `access_token=${token}`).expect(200);
        expect(access.requireMember).toHaveBeenCalledWith('team-1', 'member');
    });
    it('rejects an unauthenticated request before consulting membership', async () => {
        await request(app.getHttpServer()).get('/team/team-1/probe').expect(401);
        expect(access.requireMember).not.toHaveBeenCalled();
    });
    it('still rejects an authenticated non-member', async () => {
        access.requireMember.mockRejectedValue(new ForbiddenException());
        await request(app.getHttpServer())
            .get('/team/team-1/probe')
            .set('Authorization', `Bearer ${jwt.sign({ sub: 'outsider' })}`)
            .expect(403);
    });
});
