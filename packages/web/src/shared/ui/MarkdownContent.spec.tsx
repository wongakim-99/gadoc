import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownContent, markdownUrl } from './MarkdownContent';

describe('issue Markdown', () => {
    it('renders headings, lists, tables, tasks, quotes and code without changing the source', () => {
        const html = renderToStaticMarkup(
            <MarkdownContent>
                {
                    '# 계획\n\n- [x] 완료\n- [ ] 검증\n\n> 근거\n\n```ts\nconst ok = true;\n```\n\n| 이름 | 상태 |\n| --- | --- |\n| 작업 | 진행 |'
                }
            </MarkdownContent>,
        );
        expect(html).toContain('<h1>계획</h1>');
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('<table>');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('language-ts');
    });
    it('does not execute HTML or load images and rejects unsafe URLs', () => {
        const html = renderToStaticMarkup(
            <MarkdownContent>
                {
                    '<script>alert(1)</script>\n\n[x](javascript:alert%281%29)\n\n![그림](https://example.com/tracker.png)'
                }
            </MarkdownContent>,
        );
        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('<img');
        expect(html).toContain('이미지 열기');
        for (const unsafe of [
            'javascript:alert(1)',
            'data:text/html,test',
            'file:///tmp/a',
            '//example.com',
            '\\example.com',
        ])
            expect(markdownUrl(unsafe)).toBe('');
        for (const safe of ['https://github.com/kscold/gadoc', '/team/docs/id', '#section', 'mailto:me@example.com'])
            expect(markdownUrl(safe)).toBe(safe);
    });
});
