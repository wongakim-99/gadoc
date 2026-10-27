import { Skeleton } from '@/src/shared/ui/ShimmerLoader';

export function DocumentLoading({ compact = false }: { compact?: boolean }) {
    return (
        <div
            role="status"
            aria-label="페이지를 불러오는 중"
            data-theme="dark"
            className={compact ? 'space-y-4 py-2' : 'mx-auto max-w-[880px] space-y-7 px-6 py-14 sm:px-12'}
        >
            <span className="sr-only">페이지를 불러오는 중…</span>
            <Skeleton width={compact ? '100%' : '60%'} height={compact ? 32 : 40} />
            {[85, 65, 90, 55].map((width, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3"
                    style={{ paddingLeft: compact && index > 1 ? 16 : 0 }}
                >
                    {compact && <Skeleton width={16} height={16} radius={3} />}
                    <Skeleton width={`${width}%`} height={compact ? 12 : 16} />
                </div>
            ))}
        </div>
    );
}
