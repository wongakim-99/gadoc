import { publicAppOrigin } from './public-app-origin';

describe('공개 앱 주소', () => {
    it('기본 주소와 명시한 설치 주소를 사용함', () => {
        expect(publicAppOrigin({})).toBe('https://gadoc.kr');
        expect(publicAppOrigin({ NEXT_PUBLIC_APP_URL: 'https://team.example.test/' })).toBe('https://team.example.test');
        expect(publicAppOrigin({ NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3002', NODE_ENV: 'test' })).toBe('http://127.0.0.1:3002');
    });
    it.each(['http://gadoc.kr', 'https://user:pass@gadoc.kr', 'https://gadoc.kr/path', 'https://gadoc.kr/?x=1', 'https://gadoc.kr/#fragment', 'file:///tmp/app'])('잘못된 주소를 거절함: %s', (value) => {
        expect(() => publicAppOrigin({ NEXT_PUBLIC_APP_URL: value, NODE_ENV: 'production' })).toThrow();
    });
});
