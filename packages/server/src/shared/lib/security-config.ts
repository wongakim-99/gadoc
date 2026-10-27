import { randomBytes } from 'node:crypto';

const developmentSecret = randomBytes(48).toString('hex');

export function jwtSecret(value?: string, production = process.env.NODE_ENV === 'production') {
    if (value && value !== 'slacord-secret-key' && value.length >= 32) return value;
    if (production) throw new Error('JWT_SECRET must be a non-default secret of at least 32 characters.');
    // A missing development secret must never become a publicly known signing key.
    return developmentSecret;
}

export function isAllowedOrigin(origin?: string, env: NodeJS.ProcessEnv = process.env): boolean {
    if (!origin) return true;
    try {
        const url = new URL(origin);
        if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return false;
        const allowed = [
            'https://slacord.cloud',
            'https://www.slacord.cloud',
            env.NEXT_PUBLIC_APP_URL,
            ...(env.CORS_ORIGINS ?? '').split(','),
        ].filter(Boolean);
        if (allowed.includes(origin)) return true;
        return env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
        return false;
    }
}

export function corsOrigin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
    callback(null, isAllowedOrigin(origin));
}
