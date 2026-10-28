import { activityReason, activityRoute, objectId, safeRequestRoute } from './activity-event';

describe('사용자 활동 경로와 결과', () => {
    it.each([
        ['POST', '/api/auth/register', 'auth.register'],
        ['POST', '/api/auth/login', 'auth.login'],
        ['GET', '/api/auth/me', 'auth.me'],
        ['GET', '/api/team', 'workspace.list'],
        ['POST', '/api/team', 'workspace.create'],
        ['POST', '/api/team/example/join', 'workspace.join'],
        ['GET', '/api/team/invite/private-code', 'workspace.invite.preview'],
        ['POST', '/api/team/invite/private-code/join', 'workspace.invite.join'],
        ['POST', '/api/team/aaaaaaaaaaaaaaaaaaaaaaaa/member', 'workspace.member.add'],
        [
            'PATCH',
            '/api/team/aaaaaaaaaaaaaaaaaaaaaaaa/member/bbbbbbbbbbbbbbbbbbbbbbbb/access',
            'workspace.member.access',
        ],
    ])('%s %s를 %s로 분류한다', (method, path, action) => {
        expect(activityRoute({ method, path })?.action).toBe(action);
    });

    it('초대 코드, 알 수 없는 경로와 사용자 입력을 로그 템플릿에 포함하지 않는다', () => {
        expect(safeRequestRoute({ method: 'POST', path: '/api/team/invite/secret-token/join' })).toBe(
            '/api/team/invite/:code/join',
        );
        expect(safeRequestRoute({ method: 'GET', path: '/secret-token' })).toBe('<other>');
        expect(activityRoute({ method: 'GET', path: '/api/auth/register' })).toBeUndefined();
    });

    it.each([
        [400, 'request_rejected'],
        [401, 'authentication_required'],
        [403, 'permission_denied'],
        [409, 'conflict'],
        [429, 'rate_limited'],
        [503, 'server_error'],
        [201, 'completed'],
    ])('%s 상태를 민감 정보 없는 결과 코드로 바꾼다', (status, reason) => {
        expect(activityReason(status as number, false)).toBe(reason);
    });

    it('인증되지 않은 식별자와 연결 중단을 구분한다', () => {
        expect(objectId('arbitrary-user')).toBeUndefined();
        expect(objectId({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa' })).toBeUndefined();
        expect(activityReason(200, true)).toBe('connection_closed');
    });
});
