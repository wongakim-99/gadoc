import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
    private readonly attempts = new Map<string, { count: number; expires: number }>();
    private nextSweep = 0;

    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const now = Date.now();
        if (now >= this.nextSweep) {
            for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
            this.nextSweep = now + 60_000;
        }
        // Never trust caller-supplied proxy headers on the directly exposed API port.
        const ip = request.socket.remoteAddress ?? 'unknown';
        const email =
            typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase().slice(0, 254) : '';
        const credentialKey = `${ip}:${email}`;
        for (const [key, limit, duration] of [
            [ip, 120, 60_000],
            [credentialKey, 10, 15 * 60_000],
        ] as const) {
            let bucket = this.attempts.get(key);
            if (!bucket || bucket.expires <= now) {
                if (this.attempts.size >= 10_000)
                    throw new HttpException('요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
                bucket = { count: 0, expires: now + duration };
                this.attempts.set(key, bucket);
            }
            if (++bucket.count > limit) {
                response.setHeader('Retry-After', Math.ceil((bucket.expires - now) / 1000));
                throw new HttpException('요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
            }
        }
        // Successful sign-ins are not failed-password attempts. The IP-wide limit still applies.
        response.once?.('finish', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) this.attempts.delete(credentialKey);
        });
        return true;
    }
}
