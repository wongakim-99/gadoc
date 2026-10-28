import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import {
    activityReason,
    activityRoute,
    objectId,
    safeRequestRoute,
    type ActivityRequest,
    type ActivityEvent,
} from './activity-event';
import { ActivityService } from './activity.service';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    constructor(private readonly activity: ActivityService) {}

    use(request: ActivityRequest, response: Response, next: NextFunction): void {
        const startedAt = Date.now();
        const requestId = randomUUID();
        request.activity = { requestId };
        response.setHeader('X-Request-Id', requestId);
        let recorded = false;
        const finish = (aborted: boolean) => {
            if (recorded) return;
            recorded = true;
            response.removeListener('finish', onFinish);
            response.removeListener('close', onClose);
            const route = activityRoute(request);
            const status = aborted ? 499 : response.statusCode;
            const event: ActivityEvent = {
                requestId,
                action: route?.action ?? 'http.request',
                method: request.method,
                route: safeRequestRoute(request),
                actorId: objectId(request.user?.userId) ?? request.activity?.actorId ?? null,
                teamId: request.activity?.teamId ?? route?.teamId ?? null,
                subjectFingerprint:
                    route?.action === 'auth.login' || route?.action === 'auth.register'
                        ? this.activity.fingerprint(request.body?.email)
                        : null,
                statusCode: status,
                outcome: aborted ? 'aborted' : status < 400 ? 'success' : 'failure',
                reason: activityReason(status, aborted),
                durationMs: Math.max(0, Date.now() - startedAt),
                createdAt: new Date(),
            };
            if (route) this.activity.record(event, route);
            else this.logger.log(JSON.stringify(event));
        };
        const onFinish = () => finish(false);
        const onClose = () => finish(!response.writableFinished);
        // 인증 가드에서 거절된 요청도 응답 종료 시점에 빠짐없이 기록한다.
        response.once('finish', onFinish);
        response.once('close', onClose);
        next();
    }
}
