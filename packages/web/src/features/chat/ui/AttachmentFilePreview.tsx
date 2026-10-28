'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, File, X } from 'lucide-react';
import type { Attachment } from '@/src/entities/message/types';
import { privateFileUrl } from '@/src/shared/lib/private-files';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { filePreviewKind, previewUrl, readPreviewBytes } from './filePreview';

export function AttachmentFilePreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const kind = filePreviewKind(attachment);
    const [content, setContent] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [safeUrl, setSafeUrl] = useState<string | null>(null);
    useDialogFocusTrap({ surfaceRef, initialFocusRef: closeRef, open: true, onEscape: onClose });
    useEffect(() => {
        const controller = new AbortController();
        let blobUrl: string | undefined;
        setContent(null);
        setError('');
        const url = previewUrl(attachment.url, window.location.origin);
        setSafeUrl(url);
        if (!url || kind === 'unsupported') return;
        if (kind === 'audio' || kind === 'video') return;
        void (async () => {
            try {
                const limit = kind === 'text' ? 1024 * 1024 : 20 * 1024 * 1024;
                if (attachment.size > limit)
                    throw new Error('미리보기 용량을 초과했습니다. 다운로드해서 확인해 주세요.');
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    signal: controller.signal,
                    redirect: 'error',
                });
                const bytes = await readPreviewBytes(response, limit);
                if (controller.signal.aborted) return;
                if (kind === 'text') setContent(new TextDecoder().decode(bytes));
                else {
                    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
                        throw new Error('올바른 PDF 파일이 아닙니다.');
                    blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                    setContent(blobUrl);
                }
            } catch (failure) {
                if (!controller.signal.aborted)
                    setError(failure instanceof Error ? failure.message : '미리보기를 불러오지 못했습니다.');
            }
        })();
        return () => {
            controller.abort();
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [attachment.url, attachment.size, kind, attempt]);
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);
    const buttonClass =
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-white';
    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 sm:p-6"
            onClick={(event) => {
                event.stopPropagation();
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={surfaceRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="flex h-[85dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-primary shadow-2xl outline-none"
            >
                <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-3 py-3">
                    <p id={titleId} className="min-w-0 flex-1 truncate text-sm text-white" title={attachment.name}>
                        {attachment.name}
                    </p>
                    <a
                        href={privateFileUrl(attachment.url)}
                        download={attachment.name}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="파일 다운로드"
                        className={buttonClass}
                    >
                        <Download size={18} />
                    </a>
                    <button
                        ref={closeRef}
                        type="button"
                        aria-label="미리보기 닫기"
                        onClick={onClose}
                        className={buttonClass}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
                    {error ? (
                        <div className="m-auto space-y-3 text-center text-sm text-text-secondary">
                            <p role="alert">{error}</p>
                            <button
                                type="button"
                                onClick={() => setAttempt(attempt + 1)}
                                className="rounded border border-border-primary px-3 py-2 hover:bg-bg-hover"
                            >
                                다시 불러오기
                            </button>
                        </div>
                    ) : !safeUrl || kind === 'unsupported' ? (
                        <div className="m-auto flex flex-col items-center gap-3 text-sm text-text-secondary">
                            <File size={32} />
                            <p>이 파일 형식은 미리보기를 지원하지 않습니다.</p>
                            <p>다운로드해서 확인해 주세요.</p>
                        </div>
                    ) : kind === 'audio' ? (
                        <audio
                            controls
                            preload="metadata"
                            src={safeUrl}
                            className="m-auto w-full max-w-xl"
                            onError={() => setError('오디오를 재생할 수 없습니다. 다운로드해서 확인해 주세요.')}
                        />
                    ) : kind === 'video' ? (
                        <video
                            controls
                            preload="metadata"
                            src={safeUrl}
                            className="h-full w-full object-contain"
                            onError={() => setError('동영상을 재생할 수 없습니다. 다운로드해서 확인해 주세요.')}
                        />
                    ) : content === null ? (
                        <p role="status" className="m-auto text-sm text-text-secondary">
                            파일을 불러오는 중...
                        </p>
                    ) : kind === 'text' ? (
                        <pre className="whitespace-pre-wrap break-words text-sm text-text-primary">{content}</pre>
                    ) : (
                        <>
                            <p className="mb-2 text-xs text-text-secondary">
                                PDF가 표시되지 않으면 다운로드해서 확인해 주세요.
                            </p>
                            <iframe
                                src={content}
                                title={`${attachment.name} PDF 미리보기`}
                                className="min-h-0 w-full flex-1 border-0"
                            />
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
