import { describe, expect, it } from 'vitest';
import { canonicalShareOrigin, inviteShareUrl } from './publicLinks';

describe('public sharing links', () => {
    it('uses gadoc.kr for every production alias without changing invitation codes', () => {
        for (const origin of [
            'https://slacord.cloud',
            'https://www.slacord.cloud',
            'https://gadoc.kr',
            'https://www.gadoc.kr/',
        ]) {
            expect(inviteShareUrl(origin, 'sample_Ab-75')).toBe('https://gadoc.kr/invite/sample_Ab-75');
        }
    });
    it('preserves local/self-hosted origins and does not rewrite lookalike domains', () => {
        for (const origin of [
            'http://127.0.0.1:3202',
            'http://localhost:3002',
            'https://slacord.cloud.example',
            'https://internal.example',
        ]) {
            expect(canonicalShareOrigin(origin)).toBe(origin);
        }
    });
});
