'use client';
import { useEffect, useId, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { documentMermaidConfig } from '@slacord/document-core';
import type { DocumentBlockEditor } from './documentBlockSchema';

import { createDiagramRenderQueue, DiagramRenderTimeout } from '../model/diagramRenderQueue';

const renderDiagram = createDiagramRenderQueue();
let renderSequence = 0;
function MermaidView({
    code,
    editable,
    onChange,
}: {
    code: string;
    editable: boolean;
    onChange: (code: string) => void;
}) {
    const id = useId().replace(/[^a-z0-9]/gi, '');
    const [mode, setMode] = useState<'code' | 'preview'>('preview');
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');
    const [zoom, setZoom] = useState(1);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let current = true;
        setSvg('');
        setError('');
        const timer = window.setTimeout(() => {
            const run = async () => {
                let container: HTMLDivElement | undefined;
                try {
                    if (code.length > 10000 || code.split('\n').length > 200)
                        throw new Error('다이어그램은 10,000자와 200줄 이내로 작성해 주세요.');
                    if (
                        /^\s*---|%%\{|\bclick\s|(?:https?:|data:|javascript:|file:|url\s*\(|!\[)|<|>\s*script|@\{/im.test(
                            code,
                        )
                    )
                        throw new Error('외부 리소스, HTML, 클릭 동작과 설정 지시문은 사용할 수 없습니다.');
                    const rendered = await renderDiagram(async (isActive) => {
                        const mermaid = (await import('mermaid')).default;
                        if (!current || !isActive()) return '';
                        const colors = getComputedStyle(document.documentElement);
                        mermaid.initialize({
                            startOnLoad: false,
                            securityLevel: 'strict',
                            maxTextSize: 10000,
                            maxEdges: 100,
                            suppressErrorRendering: true,
                            flowchart: { htmlLabels: false },
                            theme: 'base',
                            themeVariables: {
                                primaryColor: colors.getPropertyValue('--color-bg-secondary').trim(),
                                primaryTextColor: colors.getPropertyValue('--color-text-primary').trim(),
                                primaryBorderColor: colors.getPropertyValue('--color-border-primary').trim(),
                                lineColor: colors.getPropertyValue('--color-text-secondary').trim(),
                                fontFamily: getComputedStyle(document.body).fontFamily,
                            },
                        });
                        container = document.createElement('div');
                        container.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
                        document.body.appendChild(container);
                        const result = await mermaid.render('diagram' + id + ++renderSequence, code, container);
                        return result.svg;
                    });
                    if (current) setSvg(rendered);
                } catch (caught) {
                    if (current)
                        setError(
                            caught instanceof DiagramRenderTimeout
                                ? '다이어그램 표시 시간이 5초를 초과했습니다. 코드를 줄이거나 다시 시도해 주세요. 원문은 유지됩니다.'
                                : '다이어그램을 표시할 수 없습니다. 문법과 크기를 확인해 주세요. 외부 리소스와 실행 지시문은 지원하지 않습니다. 원문은 유지됩니다.',
                        );
                } finally {
                    container?.remove();
                }
            };
            void run();
        }, 350);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [code, id, attempt]);
    const source = svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';
    return (
        <section
            aria-label="Mermaid 다이어그램"
            contentEditable={false}
            className="my-2 w-full min-w-0 rounded-control border border-border-primary"
        >
            <div className="flex flex-wrap items-center gap-1 border-b border-border-primary px-2 py-1 text-xs text-text-secondary">
                <button
                    type="button"
                    aria-pressed={mode === 'code'}
                    className="rounded px-2 py-1 hover:bg-bg-hover aria-pressed:bg-selection"
                    onClick={() => setMode('code')}
                >
                    코드
                </button>
                <button
                    type="button"
                    aria-pressed={mode === 'preview'}
                    className="rounded px-2 py-1 hover:bg-bg-hover aria-pressed:bg-selection"
                    onClick={() => setMode('preview')}
                >
                    미리보기
                </button>
                <button
                    type="button"
                    aria-label="다이어그램 축소"
                    disabled={zoom <= 0.5}
                    onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                    className="ml-auto rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-40"
                >
                    −
                </button>
                <button
                    type="button"
                    aria-label="다이어그램 배율 초기화"
                    onClick={() => setZoom(1)}
                    className="rounded px-2 py-1 hover:bg-bg-hover"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    type="button"
                    aria-label="다이어그램 확대"
                    disabled={zoom >= 2}
                    onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
                    className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-40"
                >
                    +
                </button>
                {source && (
                    <a href={source} download="diagram.svg" className="rounded px-2 py-1 hover:bg-bg-hover">
                        SVG 다운로드
                    </a>
                )}
            </div>
            {mode === 'code' && (
                <textarea
                    aria-label="Mermaid 코드"
                    readOnly={!editable}
                    value={code}
                    maxLength={10000}
                    onChange={(event) => onChange(event.target.value)}
                    className="block min-h-40 w-full resize-y bg-bg-primary p-3 font-mono text-sm text-text-primary"
                    spellCheck={false}
                />
            )}
            {error && (
                <div role="alert" className="p-3 text-sm text-error">
                    <p>{error}</p>
                    <button
                        type="button"
                        className="mt-2 rounded px-2 py-1 text-text-primary hover:bg-bg-hover"
                        onClick={() => setAttempt((value) => value + 1)}
                    >
                        다시 렌더링
                    </button>
                </div>
            )}
            {mode === 'preview' && (
                <div className="max-h-[600px] overflow-auto p-4">
                    {source ? (
                        <img
                            src={source}
                            alt="Mermaid 다이어그램 미리보기"
                            style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
                        />
                    ) : (
                        !error && <p role="status">미리보기 준비 중…</p>
                    )}
                </div>
            )}
        </section>
    );
}
export function createDocumentMermaidSpec() {
    return createReactBlockSpec(documentMermaidConfig, {
        render: ({ block, editor: blockEditor }) => {
            const editor = blockEditor as unknown as DocumentBlockEditor;
            return (
                <MermaidView
                    code={block.props.code}
                    editable={editor.isEditable}
                    onChange={(code) => {
                        if (editor.isEditable) editor.updateBlock(block, { props: { code } });
                    }}
                />
            );
        },
        toExternalHTML: ({ block }) => (
            <pre>
                <code>{block.props.code}</code>
            </pre>
        ),
    })();
}
