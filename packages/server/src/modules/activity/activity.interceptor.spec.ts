import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ActivityInterceptor } from './activity.interceptor';
import type { ActivityRequest } from './activity-event';

describe('검증된 응답에서 활동 식별자 추출', () => {
    const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';

    function setup(path: string) {
        const req = { method: 'POST', path, activity: { requestId: 'test' } } as ActivityRequest;
        const context = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext;
        return { req, context, interceptor: new ActivityInterceptor() };
    }

    it.each([false, true])('회원가입 응답의 래핑 여부(%s)와 관계없이 사용자 ID만 남긴다', async (wrapped) => {
        const { req, context, interceptor } = setup('/api/auth/register');
        const data = { id, email: 'private@example.test', passwordHash: 'private-hash' };
        const output = wrapped ? { success: true, data } : data;
        expect(await lastValueFrom(interceptor.intercept(context, { handle: () => of(output) }))).toEqual(output);
        expect(req.activity).toEqual({ requestId: 'test', actorId: id });
    });

    it('로그인 토큰과 비밀번호는 활동 컨텍스트에 포함하지 않는다', async () => {
        const { req, context, interceptor } = setup('/api/auth/login');
        await lastValueFrom(
            interceptor.intercept(context, { handle: () => of({ accessToken: 'private-token', user: { id } }) }),
        );
        expect(req.activity).toEqual({ requestId: 'test', actorId: id });
    });

    it('초대 참여 성공은 실제 응답의 워크스페이스 ID로 연결한다', async () => {
        const { req, context, interceptor } = setup('/api/team/invite/private-code/join');
        await lastValueFrom(
            interceptor.intercept(context, { handle: () => of({ id, inviteLinks: ['private-code'] }) }),
        );
        expect(req.activity).toEqual({ requestId: 'test', teamId: id });
    });

    it('실패 응답을 성공으로 바꾸거나 사용자 ID를 추정하지 않는다', async () => {
        const { req, context, interceptor } = setup('/api/auth/login');
        const error = new Error('private-error');
        await expect(
            lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })),
        ).rejects.toBe(error);
        expect(req.activity).toEqual({ requestId: 'test' });
    });

    it('로그아웃은 서명이 검증된 세션만 사용자 ID에 연결한다', async () => {
        const { req, context } = setup('/api/auth/logout');
        req.cookies = { access_token: 'private-token' };
        const jwt = { verify: jest.fn().mockReturnValue({ sub: id }) };
        const interceptor = new ActivityInterceptor(jwt as unknown as JwtService);
        await lastValueFrom(interceptor.intercept(context, { handle: () => of(undefined) }));
        expect(req.activity?.actorId).toBe(id);
        expect(jwt.verify).toHaveBeenCalledWith('private-token', { algorithms: ['HS256'] });
        req.activity = { requestId: 'test' };
        jwt.verify.mockImplementation(() => {
            throw new Error('invalid-token');
        });
        await lastValueFrom(interceptor.intercept(context, { handle: () => of(undefined) }));
        expect(req.activity.actorId).toBeUndefined();
    });
});
