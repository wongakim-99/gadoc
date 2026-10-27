// Preserve stored document HTML/JSON and legacy messages without rewriting the database.
export function privateFileUrl(value: string): string {
    return value.replaceAll('https://bucket.kscold.com/slacord/slacord/', '/api/files?key=slacord/');
}

export function withPrivateFiles<T>(value: T): T {
    if (typeof value === 'string') return privateFileUrl(value) as T;
    if (Array.isArray(value)) return value.map(withPrivateFiles) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withPrivateFiles(item)])) as T;
    }
    return value;
}
