export function publicAppOrigin(env: NodeJS.ProcessEnv = process.env): string {
    const value = env.NEXT_PUBLIC_APP_URL || 'https://gadoc.kr';
    const url = new URL(value);
    const development = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
        url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(development && url.protocol === 'http:'))
    ) throw new Error('NEXT_PUBLIC_APP_URL must be a secure application origin.');
    return url.origin;
}
