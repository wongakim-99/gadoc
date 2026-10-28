'use client';

import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function markdownUrl(value: string): string {
    if (/^[\s\\]*\/\//.test(value) || value.includes('\\')) return '';
    const safe = defaultUrlTransform(value);
    return /^(?:https?:|mailto:|\/|#|\?|[^:/?#]+(?:[/?#]|$))/i.test(safe) ? safe : '';
}

/** Render stored Markdown as React elements; never enable raw HTML or remote image requests. */
export function MarkdownContent({
    children,
    openLinksInNewTab = false,
}: {
    children: string;
    openLinksInNewTab?: boolean;
}) {
    return (
        <div className="issue-markdown min-w-0 break-words text-sm leading-7 text-text-primary">
            <Markdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                urlTransform={markdownUrl}
                components={{
                    a: ({ href, children }) =>
                        href ? (
                            <a
                                href={href}
                                target={openLinksInNewTab || /^https?:/i.test(href) ? '_blank' : undefined}
                                rel="noopener noreferrer"
                                className="text-action-text underline underline-offset-2"
                            >
                                {children}
                            </a>
                        ) : (
                            <span>{children}</span>
                        ),
                    img: ({ src, alt }) => (
                        <span className="inline-block rounded-control border border-border-primary px-2 py-1 text-text-secondary">
                            {typeof src === 'string' && src ? (
                                <a
                                    href={src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-action-text underline"
                                >
                                    이미지 열기: {alt || '첨부 이미지'}
                                </a>
                            ) : (
                                alt || '차단된 이미지'
                            )}
                        </span>
                    ),
                    table: ({ children }) => (
                        <div className="my-4 max-w-full overflow-x-auto">
                            <table>{children}</table>
                        </div>
                    ),
                }}
            >
                {children}
            </Markdown>
        </div>
    );
}
