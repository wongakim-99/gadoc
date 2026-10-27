'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

export function LinkPicker({
    title,
    description,
    options,
    busy,
    error,
    onClose,
    onConnect,
}: {
    title: string;
    description: string;
    options: Array<{ id: string; title: string; detail?: string }>;
    busy: boolean;
    error: string;
    onClose: () => void;
    onConnect: (id: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState('');
    const surface = useRef<HTMLDivElement>(null);
    const close = () => {
        if (!busy) onClose();
    };
    useDialogFocusTrap({ open: true, surfaceRef: surface, onEscape: close });
    const visible = options.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-4"
            onClick={(event) => {
                event.stopPropagation();
                close();
            }}
        >
            <div
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-panel border border-border-primary bg-bg-secondary p-5 shadow-2xl"
            >
                <h3 className="text-base font-semibold text-text-primary">{title}</h3>
                <p className="mt-2 text-xs text-text-secondary">{description}</p>
                <input
                    aria-label={`${title} 검색`}
                    placeholder="제목으로 검색"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="my-4 w-full rounded-control border border-border-primary bg-bg-primary p-2 text-sm"
                />
                <div role="radiogroup" aria-label="연결 대상" className="min-h-24 overflow-y-auto">
                    {visible.map((item) => (
                        <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-3 rounded-control p-3 hover:bg-bg-hover"
                        >
                            <input
                                type="radio"
                                name="link-target"
                                value={item.id}
                                checked={selected === item.id}
                                disabled={busy}
                                onChange={() => setSelected(item.id)}
                            />
                            <span className="min-w-0 break-words text-sm">
                                {item.title}
                                {item.detail && (
                                    <span className="mt-1 block text-xs text-text-tertiary">{item.detail}</span>
                                )}
                            </span>
                        </label>
                    ))}
                    {!visible.length && (
                        <p className="p-3 text-sm text-text-secondary">
                            연결할 항목이 없습니다. 검색어 또는 기존 연결을 확인하세요.
                        </p>
                    )}
                </div>
                {error && (
                    <p role="alert" className="mt-3 text-xs text-error">
                        {error}
                    </p>
                )}
                <div className="mt-4 flex justify-end gap-2 border-t border-border-primary pt-4">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={close}
                        className="rounded-control border border-border-primary px-4 py-2 text-sm"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={busy || !selected}
                        onClick={() => onConnect(selected)}
                        className="rounded-control bg-action px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {busy ? '연결 중…' : '연결하기'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
