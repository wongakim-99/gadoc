import type { Request, Response, NextFunction } from 'express';
import { isAllowedOrigin } from '../lib/security-config';

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isAllowedOrigin(req.headers.origin)) {
        res.status(403).json({ success: false, message: '허용되지 않은 출처의 요청입니다.' });
        return;
    }
    next();
}
