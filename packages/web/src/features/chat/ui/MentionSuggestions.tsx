'use client';

import { getAvatarColor } from '@/src/shared/lib/avatar';
import type { MentionCandidate } from '../model/mentionCompletion';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

interface Props {
    activeIndex: number;
    members: MentionCandidate[];
    id: string;
    anchorRef: RefObject<HTMLTextAreaElement | null>;
    onSelect: (username: string) => void;
}

export function MentionSuggestions({ activeIndex, members, onSelect, id, anchorRef }: Props) {
    const surface = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const element = surface.current;
        if (!anchor || !element) return;
        let active = true;
        const update = () => {
            element.style.width = `${Math.min(384, Math.max(240, anchor.getBoundingClientRect().width), window.innerWidth - 16)}px`;
            void computePosition(anchor, element, {
                strategy: 'fixed',
                placement: 'top-start',
                middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
                if (active) Object.assign(element.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' });
            });
        };
        const stop = autoUpdate(anchor, element, update);
        return () => {
            active = false;
            stop();
        };
    }, [anchorRef]);
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={surface}
            id={id}
            role="listbox"
            aria-label="멘션 대상"
            style={{ position: 'fixed', visibility: 'hidden' }}
            className="z-[110] max-h-48 overflow-y-auto rounded-lg border border-border-primary bg-bg-secondary shadow-xl"
        >
            {members.map((member, index) => {
                const name = member.label;
                return (
                    <button
                        key={member.id}
                        id={`${id}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        tabIndex={-1}
                        onMouseDown={(event) => {
                            event.preventDefault();
                        }}
                        onClick={() => onSelect(member.username)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${index === activeIndex ? 'bg-white/8 text-white' : 'text-text-secondary hover:bg-white/5'}`}
                    >
                        <div
                            className="h-6 w-6 shrink-0 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                            style={{ backgroundColor: getAvatarColor(member.id) }}
                        >
                            {name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="min-w-0 truncate font-medium">{name}</span>
                        <span className="ml-auto text-[11px] text-text-tertiary">{member.detail}</span>
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}
