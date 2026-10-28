const PRODUCTION_ORIGINS = new Set([
    'https://gadoc.kr',
    'https://www.gadoc.kr',
    'https://slacord.cloud',
    'https://www.slacord.cloud',
]);

/** Sharing uses the canonical domain; authentication and sockets keep their current origin. */
export function canonicalShareOrigin(origin: string) {
    const normalized = origin.replace(/\/+$/, '');
    return PRODUCTION_ORIGINS.has(normalized) ? 'https://gadoc.kr' : normalized;
}

export function inviteShareUrl(origin: string, code: string) {
    return `${canonicalShareOrigin(origin)}/invite/${encodeURIComponent(code)}`;
}
