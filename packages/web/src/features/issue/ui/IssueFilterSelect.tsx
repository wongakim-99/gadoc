'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { Check, ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    marker?: ReactNode;
}

interface Props {
    label: string;
    value: string;
    options: Option[];
    icon: ReactNode;
    active: boolean;
    onChange: (value: string) => void;
}

export function IssueFilterSelect({ label, value, options, icon, active, onChange }: Props) {
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const typeahead = useRef({ text: '', at: 0 });
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const selectedIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value),
    );
    const selected = options[selectedIndex];

    useEffect(() => {
        if (!open || !trigger.current || !menu.current) return;
        const reference = trigger.current;
        const floating = menu.current;
        let disposed = false;
        const stop = autoUpdate(reference, floating, () => {
            void computePosition(reference, floating, {
                placement: 'bottom-start',
                strategy: 'fixed',
                middleware: [
                    offset(8),
                    flip({ padding: 12 }),
                    shift({ padding: 12 }),
                    size({
                        padding: 12,
                        apply({ availableHeight, availableWidth, rects }) {
                            Object.assign(floating.style, {
                                maxHeight: `${Math.max(0, Math.min(320, availableHeight))}px`,
                                width: `${Math.min(availableWidth, Math.max(220, rects.reference.width))}px`,
                            });
                        },
                    }),
                ],
            }).then(({ x, y }) => {
                if (!disposed) Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' });
            });
        });
        const outside = (event: PointerEvent) => {
            if (!reference.contains(event.target as Node) && !floating.contains(event.target as Node)) setOpen(false);
        };
        const blur = (event: FocusEvent) => {
            if (!reference.contains(event.target as Node) && !floating.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', blur);
        return () => {
            disposed = true;
            stop();
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', blur);
        };
    }, [open]);

    useEffect(() => {
        if (open)
            menu.current?.querySelector(`#${CSS.escape(`${id}-${activeIndex}`)}`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, id, open]);

    const choose = (index: number) => {
        if (!options[index]) return;
        onChange(options[index].value);
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
    };
    const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Tab' || event.key === 'Escape') {
            setOpen(false);
            if (event.key === 'Escape' && open) event.preventDefault();
            return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (open && (event.key === 'Enter' || event.key === ' ')) choose(activeIndex);
            else {
                setOpen(true);
                setActiveIndex(
                    event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? options.length - 1
                          : !open
                            ? selectedIndex
                            : (activeIndex + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length,
                );
            }
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now();
            const text =
                (now - typeahead.current.at < 700 ? typeahead.current.text : '') + event.key.toLocaleLowerCase();
            typeahead.current = { text, at: now };
            const match = options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(text));
            if (match >= 0) {
                setOpen(true);
                setActiveIndex(match);
            }
        }
    };

    return (
        <div className="min-w-0 flex-1 basis-36 sm:flex-none sm:basis-auto">
            <button
                ref={trigger}
                type="button"
                role="combobox"
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-haspopup="listbox"
                aria-activedescendant={open ? `${id}-${activeIndex}` : undefined}
                onKeyDown={handleKey}
                onClick={() => {
                    setActiveIndex(selectedIndex);
                    setOpen(!open);
                }}
                className={`flex min-h-10 w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-action/40 ${active ? 'border-action/50 bg-action/10 text-text-primary' : 'border-border-primary bg-bg-secondary text-text-secondary hover:border-text-tertiary/50 hover:text-text-primary'}`}
            >
                <span aria-hidden="true" className="shrink-0 text-text-tertiary">
                    {icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
                <ChevronDown
                    aria-hidden="true"
                    size={14}
                    className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={menu}
                        id={id}
                        role="listbox"
                        aria-label={label}
                        style={{ position: 'fixed', visibility: 'hidden' }}
                        className="z-[90] overflow-y-auto overscroll-contain rounded-panel border border-border-primary bg-bg-secondary p-1.5 shadow-xl shadow-black/25"
                    >
                        <p aria-hidden="true" className="px-2.5 pb-2 pt-1 text-[11px] font-medium text-text-tertiary">
                            {label}
                        </p>
                        {options.map((option, index) => (
                            <div
                                key={option.value}
                                id={`${id}-${index}`}
                                role="option"
                                aria-selected={option.value === value}
                                onPointerMove={() => setActiveIndex(index)}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => choose(index)}
                                className={`flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-sm ${activeIndex === index ? 'bg-bg-hover text-text-primary' : 'text-text-secondary'}`}
                            >
                                {option.marker && (
                                    <span aria-hidden="true" className="shrink-0">
                                        {option.marker}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                                {option.value === value && (
                                    <Check aria-hidden="true" size={15} className="shrink-0 text-action-text" />
                                )}
                            </div>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
