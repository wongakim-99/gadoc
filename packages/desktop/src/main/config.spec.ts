import { getAppOrigin, getStartUrl, isAllowedUrl, resolveAppPath, isExternalUrl } from './config';

describe('desktop config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.SLACORD_DESKTOP_START_URL;
        delete process.env.SLACORD_APP_URL;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('데스크톱 시작 URL 환경변수를 우선 사용함', () => {
        process.env.SLACORD_DESKTOP_START_URL = 'https://slacord.cloud/dashboard';

        expect(getStartUrl()).toBe('https://slacord.cloud/dashboard');
        expect(getAppOrigin()).toBe('https://slacord.cloud');
    });

    it('허용된 호스트만 true를 반환함', () => {
        expect(isAllowedUrl('https://slacord.cloud/auth/login')).toBe(true);
        expect(isAllowedUrl('https://malicious.example.com')).toBe(false);
        expect(isAllowedUrl('not-a-url')).toBe(false);
    });
    it('trusts local development only at the configured origin and port', () => {
        expect(isAllowedUrl('http://localhost:3002')).toBe(false);
        expect(isAllowedUrl('http://slacord.cloud')).toBe(false);
        expect(isAllowedUrl('https://slacord.cloud:8443')).toBe(false);
        process.env.SLACORD_DESKTOP_START_URL = 'http://localhost:3002/auth/login';
        expect(isAllowedUrl('http://localhost:3002/team')).toBe(true);
        expect(isAllowedUrl('http://localhost:4000')).toBe(false);
    });
    it('notification paths cannot escape the application origin', () => {
        expect(resolveAppPath('/team/issues?issue=123')).toBe('/team/issues?issue=123');
        expect(resolveAppPath('//evil.example')).toBeNull();
        expect(resolveAppPath('/\\evil.example')).toBeNull();
        expect(resolveAppPath('https://evil.example')).toBeNull();
        expect(isExternalUrl('file:///etc/passwd')).toBe(false);
        expect(isExternalUrl('https://example.com')).toBe(true);
    });
});
