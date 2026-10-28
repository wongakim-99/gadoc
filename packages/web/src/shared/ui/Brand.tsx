import Image from 'next/image';

export function Brand({ className = '', size = 36 }: { className?: string; size?: number }) {
    return (
        <span className={`gadoc-brand ${className}`} aria-label="GaDoc">
            <Image src="/brand/gadoc-mark.svg" alt="" width={size} height={size} loading="eager" aria-hidden="true" />
            <svg aria-hidden="true" width={size * 3.05} height={size} viewBox="0 0 365 116" fill="none" className="shrink-0">
                <g stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="40" cy="51" r="27" />
                    <path d="M67 27V78C67 106 35 114 17 96" />
                    <circle cx="116" cy="51" r="27" /><path d="M143 51V78" />
                    <circle cx="192" cy="51" r="27" /><path d="M219 51V10" />
                    <circle cx="268" cy="51" r="27" />
                    <path d="M354 30A27 27 0 1 0 354 72" />
                </g>
            </svg>
        </span>
    );
}
