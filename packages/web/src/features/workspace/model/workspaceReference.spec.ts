import { describe, expect, it } from 'vitest';
import { referenceMarkdown, sameDocument, workspaceHref } from './workspaceReference';

describe('workspace reference boundaries', () => {
    it('accepts resource deep links and removes split recursion parameters', () => {
        expect(workspaceHref('/team/channel/c?message=m&at=now&beside=x', 'team', 'https://app.test')).toBe(
            '/team/channel/c?message=m&at=now',
        );
        expect(workspaceHref('/team/issues?issue=i', 'team', 'https://app.test')).toBe('/team/issues?issue=i');
    });
    it('rejects foreign origins, workspaces, executable URLs and unrelated routes', () => {
        for (const href of [
            'https://evil.test/team/docs/a',
            '//evil.test/team/docs/a',
            '/other/docs/a',
            'javascript:alert(1)',
            '/team/settings',
            '/team/docs/archived',
            '/team/issues/a',
            '/team/docs/a/extra',
        ]) {
            expect(workspaceHref(href, 'team', 'https://app.test')).toBeNull();
        }
    });
    it('preserves a safe durable link without copying source content', () => {
        expect(referenceMarkdown({ kind: 'docs', label: '[Plan]\nReady', href: '/team/docs/a' })).toBe(
            '[ Plan  Ready](/team/docs/a)',
        );
        expect(sameDocument('/team/docs/a?new=1', '/team/docs/a#block')).toBe(true);
        expect(sameDocument('/team/channel/a', '/team/channel/a')).toBe(false);
    });
});
