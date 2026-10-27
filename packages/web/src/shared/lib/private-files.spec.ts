import { describe, expect, it } from 'vitest';
import { privateFileUrl, withPrivateFiles } from './private-files';

describe('legacy private attachment URLs', () => {
    const key = 'slacord/docs/team/doc/page/2026-10-27/file.png';
    const old = `https://bucket.kscold.com/slacord/${key}`;
    it('preserves links embedded in JSON and HTML without exposing bucket credentials', () => {
        const result = withPrivateFiles({
            content: JSON.stringify([{ props: { url: old } }]),
            attachment: { url: old },
            html: `<img src="${old}">`,
        });
        expect(result.attachment.url).toBe(`/api/files?key=${key}`);
        expect(JSON.parse(result.content)[0].props.url).toBe(`/api/files?key=${key}`);
        expect(result.html).toContain('src="/api/files?key=');
    });
    it('does not rewrite other tenants, external media, or already private URLs', () => {
        for (const url of [
            'https://bucket.kscold.com/blog/file.png',
            'https://other.example/slacord/file',
            '/api/files?key=slacord/docs/team/file',
        ])
            expect(privateFileUrl(url)).toBe(url);
    });
});
