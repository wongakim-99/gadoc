import type { Request } from 'express';

export const ACTIVITY_RETENTION_DAYS = 30;

export interface ActivityContext {
    requestId: string;
    actorId?: string;
    teamId?: string;
}

export interface ActivityRequest extends Request {
    activity?: ActivityContext;
    user?: { userId?: string };
}

export interface ActivityRoute {
    action: string;
    route: string;
    teamId?: string;
    slug?: string;
    inviteCode?: string;
}

export interface ActivityEvent {
    requestId: string;
    action: string;
    method: string;
    route: string;
    actorId: string | null;
    subjectFingerprint: string | null;
    teamId: string | null;
    statusCode: number;
    outcome: 'success' | 'failure' | 'aborted';
    reason: string;
    durationMs: number;
    createdAt: Date;
}

export function objectId(value: unknown): string | undefined {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) ? value.toLowerCase() : undefined;
}

/** 로그 경로는 허용 목록의 템플릿으로만 구성해 초대 코드와 쿼리를 남기지 않는다. */
export function activityRoute(request: Pick<Request, 'method' | 'path'>): ActivityRoute | undefined {
    const path = request.path.replace(/\/$/, '');
    const auth = /^\/api\/auth\/(register|login|logout|me)$/.exec(path);
    if (auth && request.method === (auth[1] === 'me' ? 'GET' : 'POST')) {
        return { action: `auth.${auth[1]}`, route: `/api/auth/${auth[1]}` };
    }
    if (path === '/api/team' && ['GET', 'POST'].includes(request.method)) {
        return { action: request.method === 'GET' ? 'workspace.list' : 'workspace.create', route: '/api/team' };
    }
    const invite = /^\/api\/team\/invite\/([^/]{1,256})(\/join)?$/.exec(path);
    if (invite && request.method === (invite[2] ? 'POST' : 'GET')) {
        return {
            action: invite[2] ? 'workspace.invite.join' : 'workspace.invite.preview',
            route: `/api/team/invite/:code${invite[2] ? '/join' : ''}`,
            inviteCode: invite[1],
        };
    }
    const join = /^\/api\/team\/([a-z\d-]{1,100})\/join$/i.exec(path);
    if (join && request.method === 'POST') {
        return { action: 'workspace.join', route: '/api/team/:slug/join', slug: join[1] };
    }
    const team = /^\/api\/team\/([a-f\d]{24})(\/profile|\/member(?:\/[a-f\d]{24}\/access)?)?$/i.exec(path);
    if (!team) return undefined;
    const suffix = team[2] ?? '';
    const action =
        !suffix && request.method === 'GET'
            ? 'workspace.view'
            : suffix === '/profile' && request.method === 'PATCH'
              ? 'workspace.update'
              : suffix === '/member' && request.method === 'POST'
                ? 'workspace.member.add'
                : suffix.endsWith('/access') && request.method === 'PATCH'
                  ? 'workspace.member.access'
                  : undefined;
    if (!action) return undefined;
    return {
        action,
        teamId: team[1].toLowerCase(),
        route: `/api/team/:teamId${suffix.replace(/[a-f\d]{24}/i, ':memberId')}`,
    };
}

export function activityReason(status: number, aborted: boolean): string {
    if (aborted) return 'connection_closed';
    if (status < 400) return 'completed';
    if (status === 401) return 'authentication_required';
    if (status === 403) return 'permission_denied';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 429) return 'rate_limited';
    return status >= 500 ? 'server_error' : 'request_rejected';
}

export function safeRequestRoute(request: Pick<Request, 'method' | 'path'> & { route?: { path?: unknown } }): string {
    const known = activityRoute(request)?.route;
    if (known) return known;
    // Express에 등록된 템플릿은 사용할 수 있지만 원본 URL은 대체 값으로 쓰지 않는다.
    const template = request.route?.path;
    return typeof template === 'string' && template.length < 240 && !/[\r\n?]/.test(template) ? template : '<other>';
}
