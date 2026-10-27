'use client';

import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const dialogStack: HTMLElement[] = [];

interface Options {
    initialFocusRef?: RefObject<HTMLElement | null>;
    onEscape?: () => void;
    open: boolean;
    restoreFocusRef?: RefObject<HTMLElement | null>;
    surfaceRef: RefObject<HTMLElement | null>;
}

function getFocusableElements(surface: HTMLElement) {
    return Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
    );
}

export function useDialogFocusTrap({ initialFocusRef, onEscape, open, restoreFocusRef, surfaceRef }: Options) {
    const onEscapeRef = useRef(onEscape);
    onEscapeRef.current = onEscape;
    useEffect(() => {
        if (!open) return;

        const surface = surfaceRef.current;
        if (!surface) return;

        dialogStack.push(surface);

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const focusTarget = initialFocusRef?.current ?? getFocusableElements(surface)[0] ?? surface;
        focusTarget.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (dialogStack.at(-1) !== surface) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                onEscapeRef.current?.();
                return;
            }

            if (event.key !== 'Tab') return;

            const focusableElements = getFocusableElements(surface);
            if (focusableElements.length === 0) {
                event.preventDefault();
                surface.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement;

            if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }

            if (event.shiftKey && activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            const index = dialogStack.indexOf(surface);
            if (index !== -1) dialogStack.splice(index, 1);
            document.removeEventListener('keydown', handleKeyDown);

            const restoreTarget = restoreFocusRef?.current ?? previousActiveElement;
            restoreTarget?.focus();
        };
    }, [initialFocusRef, open, restoreFocusRef, surfaceRef]);
}
