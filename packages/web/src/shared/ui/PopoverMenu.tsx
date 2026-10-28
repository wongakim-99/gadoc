'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
export function PopoverMenu({
    label,
    icon,
    children,
    open: controlled,
    onOpenChange,
    triggerClassName,
    width = 360,
    placement = 'bottom',
    showHeader = true,
}: {
    label: string;
    icon: ReactNode;
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    triggerClassName?: string;
    width?: number;
    placement?: 'top' | 'bottom';
    showHeader?: boolean;
}) {
    const [local, setLocal] = useState(false),
        [position, setPosition] = useState({ top: 0, left: 0 });
    const open = controlled ?? local;
    const setOpen = (value: boolean) => {
        setLocal(value);
        onOpenChange?.(value);
    };
    const button = useRef<HTMLButtonElement>(null),
        surface = useRef<HTMLDivElement>(null);
    useDialogFocusTrap({ open, surfaceRef: surface, restoreFocusRef: button, onEscape: () => setOpen(false) });
    useEffect(() => {
        if (!open) return;
        const update = () => {
            const rect = button.current?.getBoundingClientRect();
            if (rect)
                setPosition({
                    top: Math.max(8, Math.min(placement === 'top' ? rect.top - (surface.current?.offsetHeight ?? 220) - 8 : rect.bottom + 6, window.innerHeight - (surface.current?.offsetHeight ?? 220) - 8)),
                    left: Math.max(8, Math.min(placement === 'top' ? rect.left : rect.right - width, window.innerWidth - width - 8)),
                });
        };
        update();
        const outside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!button.current?.contains(target) && !surface.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        const observer = new ResizeObserver(update);
        if (surface.current) observer.observe(surface.current);
        return () => {
            document.removeEventListener('pointerdown', outside);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            observer.disconnect();
        };
    }, [open, width, placement]);
    return (
        <>
            <button
                ref={button}
                type="button"
                aria-label={label}
                title={label}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={
                    triggerClassName ??
                    'flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-action'
                }
            >
                {icon}
            </button>
            {open &&
                createPortal(
                    <div
                        ref={surface}
                        role="dialog"
                        aria-label={label}
                        tabIndex={-1}
                        data-manages-draft-navigation="true"
                        style={{
                            position: 'fixed',
                            top: position.top,
                            left: position.left,
                            width,
                            maxHeight: `calc(100vh - ${position.top + 12}px)`,
                        }}
                        className="z-[90] w-[360px] max-w-[calc(100vw-16px)] space-y-3 overflow-auto rounded-lg border border-border-primary bg-bg-primary p-3 text-sm shadow-xl"
                    >
                        {showHeader && <div className="flex items-center justify-between border-b border-border-primary pb-2">
                            <span className="font-medium">{label}</span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label={`${label} 닫기`}
                                className="rounded px-2 py-1 text-text-secondary hover:bg-bg-hover"
                            >
                                ×
                            </button>
                        </div>}
                        {children}
                    </div>,
                    document.body,
                )}
        </>
    );
}
