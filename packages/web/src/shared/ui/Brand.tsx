import Image from 'next/image';

export function Brand({ className = '', size = 36 }: { className?: string; size?: number }) {
    return (
        <span className={`gadoc-brand ${className}`} aria-label="GaDoc">
            <Image src="/brand/gadoc-mark.svg" alt="" width={size} height={size} loading="eager" aria-hidden="true" />
            <span className="gadoc-wordmark" aria-hidden="true">
                Ga<span>Doc</span>
            </span>
        </span>
    );
}
