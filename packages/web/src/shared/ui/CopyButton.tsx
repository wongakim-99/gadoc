'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText } from '../lib/copyText';

export function CopyButton({
    value,
    children,
    className,
    disabled,
    label,
}: {
    value: string;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    label?: string;
}) {
    const [result, setResult] = useState<{ value: string; error: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const manual = useRef<HTMLTextAreaElement>(null);
    const current = result?.value === value ? result : null;
    useEffect(() => {
        if (current?.error) {
            manual.current?.focus({ preventScroll: true });
            manual.current?.select();
        }
    }, [current]);
    return (
        <>
            <button
                type="button"
                aria-label={label}
                className={className}
                disabled={disabled || busy || !value}
                onClick={async () => {
                    if (pending.current) return;
                    pending.current = true;
                    setBusy(true);
                    setResult(null);
                    try {
                        await copyText(value);
                        setResult({ value, error: '' });
                    } catch (caught) {
                        setResult({ value, error: caught instanceof Error ? caught.message : '복사하지 못했습니다.' });
                    } finally {
                        pending.current = false;
                        setBusy(false);
                    }
                }}
            >
                {children}
            </button>
            {current &&
                (current.error ? (
                    <span className="block w-full min-w-0 space-y-1 text-xs">
                        <span role="alert" className="block text-error">
                            {current.error}
                        </span>
                        <textarea
                            ref={manual}
                            aria-label="직접 복사할 내용"
                            value={value}
                            readOnly
                            rows={2}
                            onFocus={(event) => event.currentTarget.select()}
                            className="block w-full rounded-control border border-border-primary bg-bg-primary p-2 text-text-primary"
                        />
                    </span>
                ) : (
                    <span role="status" className="self-center text-xs text-text-secondary">
                        복사했습니다.
                    </span>
                ))}
        </>
    );
}
