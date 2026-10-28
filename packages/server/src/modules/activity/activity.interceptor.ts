import { Injectable, Optional, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { tap } from 'rxjs';
import { activityRoute, objectId, type ActivityRequest } from './activity-event';

function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

/** 성공 응답에서 검증된 식별자만 옮기며 응답 본문과 토큰은 보관하지 않는다. */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
    constructor(@Optional() private readonly jwt?: JwtService) {}

    intercept(context: ExecutionContext, next: CallHandler) {
        if (context.getType() !== 'http') return next.handle();
        const request = context.switchToHttp().getRequest<ActivityRequest>();
        const action = activityRoute(request)?.action;
        if (request.activity && ['auth.logout', 'workspace.invite.preview'].includes(action ?? '')) {
            const token = request.cookies?.access_token ?? request.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
            if (typeof token === 'string') {
                try {
                    request.activity.actorId = objectId(this.jwt?.verify(token, { algorithms: ['HS256'] }).sub);
                } catch {
                    // 공개 경로의 만료/위조 토큰은 인증된 사용자로 기록하지 않는다.
                }
            }
        }
        return next.handle().pipe(
            tap((response: unknown) => {
                if (!request.activity) return;
                const outer = record(response);
                const body = record(outer?.success === true ? outer.data : response);
                if (action === 'auth.register' || action === 'auth.me') {
                    request.activity.actorId = objectId(body?.id);
                } else if (action === 'auth.login') {
                    request.activity.actorId = objectId(record(body?.user)?.id);
                } else if (['workspace.join', 'workspace.invite.join', 'workspace.create'].includes(action ?? '')) {
                    request.activity.teamId = objectId(body?.id);
                }
            }),
        );
    }
}
