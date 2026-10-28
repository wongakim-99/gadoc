'use client';

import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { Search, X } from 'lucide-react';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { EMOJI_CATEGORIES, findEmojiChoices, type EmojiCategory } from '../model/emojiCatalog';

interface Props {
    emojis: string[];
    open: boolean;
    onClose: () => void;
    onSelect: (emoji: string) => void;
    align?: 'left' | 'right';
    anchorRef: RefObject<HTMLButtonElement | null>;
}

export function EmojiPickerPopover(props: Props) {
    return props.open ? <EmojiPickerContent {...props} /> : null;
}

function EmojiPickerContent({ emojis, onClose, onSelect, align = 'right', anchorRef }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    const searchRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<EmojiCategory>('추천');
    const [preview, setPreview] = useState('이모지로 가볍게 답해보세요');
    const [positioned, setPositioned] = useState(false);
    const choices = findEmojiChoices(query, category, emojis);
    useDialogFocusTrap({
        open: positioned,
        surfaceRef: panelRef,
        initialFocusRef: searchRef,
        restoreFocusRef: anchorRef,
        onEscape: onClose,
    });
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const surface = panelRef.current;
        if (!anchor || !surface) return;
        let current = true;
        const update = () =>
            void computePosition(anchor, surface, {
                strategy: 'fixed',
                placement: align === 'left' ? 'top-start' : 'bottom-end',
                middleware: [
                    offset(8),
                    flip(),
                    shift({ padding: 8 }),
                    size({
                        padding: 8,
                        apply({ availableHeight, elements }) {
                            elements.floating.style.maxHeight = `${Math.max(0, Math.min(420, availableHeight))}px`;
                        },
                    }),
                ],
            }).then(({ x, y }) => {
                if (current) {
                    Object.assign(surface.style, { left: `${x}px`, top: `${y}px` });
                    setPositioned(true);
                }
            });
        const stop = autoUpdate(anchor, surface, update);
        const outside = (event: PointerEvent) => {
            if (surface.contains(event.target as Node) || anchor.contains(event.target as Node)) return;
            close.current();
        };
        window.addEventListener('pointerdown', outside, true);
        return () => {
            current = false;
            stop();
            window.removeEventListener('pointerdown', outside, true);
        };
    }, [align, anchorRef]);

    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            style={{
                position: 'fixed',
                visibility: positioned ? 'visible' : 'hidden',
                width: 'min(320px, calc(100vw - 16px))',
            }}
            className="z-[110] flex flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-secondary shadow-2xl"
        >
            <header className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
                <h3 id={titleId} className="text-sm font-semibold text-text-primary">
                    리액션 선택
                </h3>
                <button
                    type="button"
                    aria-label="이모지 선택 닫기"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-hover"
                >
                    <X size={16} />
                </button>
            </header>
            <div className="relative mx-3 mb-2 shrink-0">
                <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-2.5 text-text-tertiary"
                />
                <input
                    ref={searchRef}
                    type="search"
                    aria-label="이모지 검색"
                    placeholder="웃음, 축하, :thumbsup: 검색"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            panelRef.current?.querySelector<HTMLButtonElement>('[data-emoji]')?.focus();
                        }
                    }}
                    className="h-9 w-full rounded-lg border border-border-primary bg-bg-primary pr-3 pl-9 text-sm text-text-primary outline-none focus:border-text-tertiary"
                />
            </div>
            <nav aria-label="이모지 분류" className="mx-3 flex shrink-0 gap-0.5 border-b border-border-primary pb-2">
                {EMOJI_CATEGORIES.map((value) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={category === value && !query}
                        onClick={() => {
                            setCategory(value);
                            setQuery('');
                        }}
                        className={`flex-1 rounded-md px-1 py-1.5 text-xs transition-colors ${category === value && !query ? 'bg-bg-hover font-semibold text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                        {value}
                    </button>
                ))}
            </nav>
            <div
                className="min-h-0 flex-1 overflow-y-auto p-3"
                onKeyDown={(event) => {
                    if (!(event.target instanceof HTMLButtonElement) || !event.target.hasAttribute('data-emoji'))
                        return;
                    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-emoji]'));
                    const index = buttons.indexOf(event.target);
                    const next = (
                        {
                            ArrowRight: index + 1,
                            ArrowLeft: index - 1,
                            ArrowDown: index + 8,
                            ArrowUp: index - 8,
                            Home: 0,
                            End: buttons.length - 1,
                        } as Record<string, number>
                    )[event.key];
                    if (next === undefined) return;
                    event.preventDefault();
                    if (next < 0) searchRef.current?.focus();
                    else buttons[Math.min(next, buttons.length - 1)]?.focus();
                }}
            >
                <p className="mb-2 text-[11px] font-medium text-text-tertiary">
                    {query ? `검색 결과 ${choices.length}` : category}
                </p>
                {choices.length ? (
                    <div className="grid grid-cols-8 gap-0.5">
                        {choices.map((choice) => (
                            <button
                                key={choice.emoji}
                                type="button"
                                data-emoji={choice.emoji}
                                aria-label={`${choice.emoji} ${choice.name}`}
                                title={choice.name}
                                onMouseEnter={() => setPreview(choice.name)}
                                onFocus={() => setPreview(choice.name)}
                                onClick={() => {
                                    onSelect(choice.emoji);
                                    onClose();
                                }}
                                className="flex aspect-square min-h-8 items-center justify-center rounded-lg text-[23px] transition-colors hover:bg-bg-hover focus:bg-bg-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary"
                                style={{
                                    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                                }}
                            >
                                {choice.emoji}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="py-6 text-center text-sm text-text-secondary">다른 이름으로 검색해보세요.</p>
                )}
            </div>
            <footer className="shrink-0 border-t border-border-primary px-4 py-2 text-[11px] text-text-tertiary">
                {preview}
            </footer>
        </div>,
        document.body,
    );
}
