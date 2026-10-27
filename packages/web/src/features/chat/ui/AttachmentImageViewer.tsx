'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ImageOff, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Attachment } from '@/src/entities/message/types';
import { privateFileUrl } from '@/src/shared/lib/private-files';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

interface Props {
    images: Attachment[];
    index: number;
    onChange: (index: number) => void;
    onClose: () => void;
}

export function AttachmentImageViewer({ images, index, onChange, onClose }: Props) {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const attachment = images[index];
    useDialogFocusTrap({ surfaceRef, initialFocusRef: closeRef, open: true, onEscape: onClose });
    useEffect(() => {
        // Changing the image remounts its zoom controls; keep focus in the dialog.
        if (!surfaceRef.current?.contains(document.activeElement)) closeRef.current?.focus();
    }, [attachment.url]);
    useEffect(() => {
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
        };
    }, []);

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
                aria-label="사진 미리보기"
                aria-describedby={titleId}
                tabIndex={-1}
                className="flex h-full max-h-[92dvh] w-full max-w-[96rem] flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-primary shadow-2xl outline-none"
                onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        event.stopPropagation();
                        onChange(
                            Math.max(0, Math.min(images.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1))),
                        );
                    }
                }}
            >
                <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-3 py-3 sm:px-5">
                    <p id={titleId} className="min-w-0 flex-1 truncate text-sm text-white" title={attachment.name}>
                        {attachment.name}
                    </p>
                    {images.length > 1 && (
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                aria-label="이전 사진"
                                disabled={index === 0}
                                onClick={() => onChange(index - 1)}
                                className={toolbarButton}
                            >
                                <ChevronLeft size={18} aria-hidden="true" />
                            </button>
                            <span className="min-w-10 text-center text-xs text-text-secondary" aria-live="polite">
                                {index + 1} / {images.length}
                            </span>
                            <button
                                type="button"
                                aria-label="다음 사진"
                                disabled={index === images.length - 1}
                                onClick={() => onChange(index + 1)}
                                className={toolbarButton}
                            >
                                <ChevronRight size={18} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <a
                        href={privateFileUrl(attachment.url)}
                        download={attachment.name}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="사진 다운로드"
                        className={toolbarButton}
                    >
                        <Download size={18} aria-hidden="true" />
                    </a>
                    <button
                        ref={closeRef}
                        type="button"
                        aria-label="사진 닫기"
                        onClick={onClose}
                        className={toolbarButton}
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
                <PreviewImage key={attachment.url} attachment={attachment} onRetry={() => closeRef.current?.focus()} />
            </div>
        </div>,
        document.body,
    );
}

const toolbarButton =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-white focus-visible:outline-2 focus-visible:outline-action-text disabled:opacity-30 disabled:hover:bg-transparent';

function PreviewImage({ attachment, onRetry }: { attachment: Attachment; onRetry: () => void }) {
    const [zoomed, setZoomed] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [attempt, setAttempt] = useState(0);
    return (
        <>
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-5">
                {status === 'loading' && (
                    <p
                        role="status"
                        className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary"
                    >
                        사진을 불러오는 중...
                    </p>
                )}
                {status === 'failed' ? (
                    <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center text-text-secondary">
                        <ImageOff size={32} aria-hidden="true" />
                        <p role="status">사진을 불러오지 못했습니다. 파일 접근 권한이나 연결 상태를 확인해 주세요.</p>
                        <button
                            type="button"
                            onClick={() => {
                                onRetry();
                                setStatus('loading');
                                setAttempt(attempt + 1);
                            }}
                            className="rounded-md border border-border-primary px-4 py-2 text-sm text-white hover:bg-bg-hover"
                        >
                            다시 불러오기
                        </button>
                    </div>
                ) : (
                    <img
                        key={attempt}
                        src={privateFileUrl(attachment.url)}
                        alt={attachment.name}
                        className={`m-auto shrink-0 ${zoomed ? 'max-h-none max-w-none' : 'max-h-full max-w-full object-contain'} ${status === 'loading' ? 'invisible' : ''}`}
                        onLoad={() => setStatus('ready')}
                        onError={() => setStatus('failed')}
                    />
                )}
            </div>
            <div className="flex shrink-0 justify-center border-t border-border-primary px-3 py-2">
                <button
                    type="button"
                    disabled={status !== 'ready'}
                    onClick={() => setZoomed(!zoomed)}
                    aria-pressed={zoomed}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-white disabled:opacity-40"
                >
                    {zoomed ? <ZoomOut size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
                    {zoomed ? '화면에 맞추기' : '원본 크기'}
                </button>
            </div>
        </>
    );
}
