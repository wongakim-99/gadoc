import { isAllowedOrigin, jwtSecret } from './security-config';
import { bridgeWebhookUrl, confluencePageUrl, confluenceSite } from './outbound-url';

describe('security configuration', () => {
    it('rejects missing and publicly known production signing keys', () => {
        for (const secret of [undefined, '', 'slacord-secret-key', 'short'])
            expect(() => jwtSecret(secret, true)).toThrow();
        expect(jwtSecret('a'.repeat(32), true)).toBe('a'.repeat(32));
        expect(jwtSecret(undefined, false)).toHaveLength(96);
        expect(jwtSecret(undefined, false)).toBe(jwtSecret(undefined, false));
    });
    it('keeps production origins exact and rejects sibling/opaque/loopback origins', () => {
        const env = { NODE_ENV: 'production' };
        for (const value of [
            'https://evil.example',
            'https://slacord.cloud.evil.example',
            'null',
            'http://127.0.0.1:3002',
            'https://slacord.cloud/path',
            'https://gadoc.kr.evil.example',
            'https://gadoc.kr/path',
            'https://gadoc.kr:8443',
            'http://gadoc.kr',
        ])
            expect(isAllowedOrigin(value, env)).toBe(false);
        expect(isAllowedOrigin('https://slacord.cloud', env)).toBe(true);
        expect(isAllowedOrigin('https://gadoc.kr', env)).toBe(true);
        expect(isAllowedOrigin('https://www.gadoc.kr', env)).toBe(true);
        expect(isAllowedOrigin(undefined, env)).toBe(true);
        expect(isAllowedOrigin('http://127.0.0.1:3202', { NODE_ENV: 'test' })).toBe(true);
    });
    it.each([
        'http://127.0.0.1',
        'https://169.254.169.254',
        'https://team.atlassian.net.evil.example',
        'https://team.atlassian.net@evil.example',
        'https://team.atlassian.net:8443',
        'https://team.atlassian.net/wiki',
    ])('rejects unsafe Confluence sites: %s', (value) => expect(() => confluenceSite(value)).toThrow());
    it('restricts paginated credential-bearing requests to the same origin', () => {
        const origin = confluenceSite('https://team.atlassian.net/');
        expect(confluencePageUrl('/wiki/api/v2/pages?cursor=x', origin)).toBe(`${origin}/wiki/api/v2/pages?cursor=x`);
        expect(() => confluencePageUrl('https://evil.example/wiki/api/v2/pages', origin)).toThrow();
        expect(() => confluencePageUrl('//127.0.0.1/wiki/api/v2/pages', origin)).toThrow();
    });
    it('only sends webhooks to official provider paths', () => {
        expect(bridgeWebhookUrl('slack', 'https://hooks.slack.com/services/T/B/token')).toContain('hooks.slack.com');
        expect(bridgeWebhookUrl('discord', 'https://discord.com/api/webhooks/123/token')).toContain('discord.com');
        for (const value of [
            'http://127.0.0.1/hook',
            'https://hooks.slack.com.evil.example/services/T/B/token',
            'https://discord.com/other',
            'https://discord.com@evil.example/api/webhooks/1/token',
        ])
            expect(() => bridgeWebhookUrl('discord', value)).toThrow();
    });
    it('allows one explicit loopback mock origin only in the test profile', () => {
        const origin = 'http://127.0.0.1:19447';
        expect(
            bridgeWebhookUrl('slack', `${origin}/slack`, { NODE_ENV: 'test', SLACORD_BRIDGE_TEST_ORIGIN: origin }),
        ).toBe(`${origin}/slack`);
        for (const mode of ['production', 'development'])
            expect(() =>
                bridgeWebhookUrl('slack', `${origin}/slack`, { NODE_ENV: mode, SLACORD_BRIDGE_TEST_ORIGIN: origin }),
            ).toThrow();
        expect(() =>
            bridgeWebhookUrl('slack', 'http://127.0.0.1:9000/slack', {
                NODE_ENV: 'test',
                SLACORD_BRIDGE_TEST_ORIGIN: origin,
            }),
        ).toThrow();
    });
});
