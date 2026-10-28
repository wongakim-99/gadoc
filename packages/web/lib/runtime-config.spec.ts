import { afterEach, describe, expect, it, vi } from 'vitest';
import { socketUrl, toApiUrl } from './runtime-config';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('도메인 전환 중 API와 소켓', () => {
    it.each(['https://gadoc.kr', 'https://www.gadoc.kr', 'https://slacord.cloud', 'https://www.slacord.cloud'])('인증 쿠키와 같은 출처를 유지함: %s', (origin) => {
        vi.stubGlobal('window', { location: { origin } });
        vi.stubEnv('NEXT_PUBLIC_SOCKET_URL', 'https://gadoc.kr');
        expect(socketUrl()).toBe(origin);
        expect(toApiUrl('api/auth/me')).toBe('/api/auth/me');
    });
    it('로컬 개발의 별도 소켓 포트 설정은 보존함', () => {
        vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:3302' } });
        vi.stubEnv('NEXT_PUBLIC_SOCKET_URL', 'http://127.0.0.1:18086/');
        expect(socketUrl()).toBe('http://127.0.0.1:18086');
    });
});
