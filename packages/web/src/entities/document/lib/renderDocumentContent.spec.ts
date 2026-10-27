import { describe, expect, it } from 'vitest';
import { renderDocumentContent } from './renderDocumentContent';

describe('document content security', () => {
    it.each([
        '<a href=javascript:alert(1)>link</a>',
        '<a href="java&#x73;cript:alert(1)">link</a>',
        '<a href="java\nscript:alert(1)">link</a>',
        '<img src=x onerror=alert(1)>',
        '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
        '<form action="https://evil.example"><input type=password autofocus></form>',
        '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
    ])('removes active markup: %s', (content) => {
        const html = renderDocumentContent({ contentFormat: 'html', content });
        expect(html).not.toMatch(/javascript:|onerror|<svg|<math|<iframe|<script|<form|type="password"|data:image/i);
    });
    it('keeps safe tables, images and links', () => {
        const html = renderDocumentContent({
            contentFormat: 'html',
            content:
                '<table><tr><td>내용</td></tr></table><img src="https://bucket.example/image.png" alt="사진"><a href="https://example.com">문서</a>',
        });
        expect(html).toContain('class="table-scroll"');
        expect(html).toContain('alt="사진"');
        expect(html).toContain('rel="noopener noreferrer"');
    });
    it('escapes markdown link attributes before converting to HTML', () => {
        const html = renderDocumentContent({
            contentFormat: 'plain',
            content: '[link](https://example.com/"onmouseover="alert)',
        });
        expect(html).not.toContain(' onmouseover=');
    });
});
