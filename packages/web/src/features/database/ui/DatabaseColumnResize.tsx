'use client';
import { useRef } from 'react';
export function DatabaseColumnResize({
    name,
    width,
    onChange,
    disabled = false,
}: {
    name: string;
    width: number;
    onChange: (width: number) => void;
    disabled?: boolean;
}) {
    const drag = useRef<{ x: number; width: number } | null>(null);
    const resize = (value: number) => onChange(Math.max(120, Math.min(800, Math.round(value))));
    return (
        <div
            role="separator"
            aria-label={`${name} 열 너비`}
            aria-orientation="vertical"
            aria-valuemin={120}
            aria-valuemax={800}
            aria-valuenow={width}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-accent-primary/30 focus-visible:bg-accent-primary/30"
            onPointerDown={(event) => {
                if (disabled) return;
                event.preventDefault();
                event.stopPropagation();
                drag.current = { x: event.clientX, width };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (drag.current) {
                    event.stopPropagation();
                    resize(drag.current.width + event.clientX - drag.current.x);
                }
            }}
            onPointerUp={(event) => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
                drag.current = null;
            }}
            onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    event.stopPropagation();
                    resize(width + (event.key === 'ArrowLeft' ? -20 : 20));
                } else if (event.key === 'Home') {
                    event.preventDefault();
                    resize(120);
                } else if (event.key === 'End') {
                    event.preventDefault();
                    resize(800);
                }
            }}
        />
    );
}
