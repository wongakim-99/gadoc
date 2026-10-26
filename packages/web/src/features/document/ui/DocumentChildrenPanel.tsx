import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import type { DocumentNode } from '@/src/entities/document/types';

interface Props {
    teamId: string;
    children: DocumentNode[];
    onCreate?: () => void;
    creating?: boolean;
}

export function DocumentChildrenPanel({ teamId, children, onCreate, creating }: Props) {
    if (children.length === 0 && !onCreate) return null;
    return (
        <section aria-label="하위 페이지" className="mt-10 border-t border-border-primary pt-5">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-medium text-text-tertiary">
                        하위 페이지 {children.length > 0 ? children.length : ''}
                    </h2>
                </div>
            </div>
            <div className="space-y-1">
                {children.map((child) => (
                    <Link
                        key={child.id}
                        href={`/${teamId}/docs/${child.id}`}
                        className="flex items-center gap-2 rounded px-2 py-2 text-sm text-text-primary hover:bg-bg-hover"
                    >
                        <FileText size={16} className="shrink-0 text-text-tertiary" />
                        <span className="truncate underline decoration-border-primary underline-offset-4">
                            {child.title}
                        </span>
                    </Link>
                ))}
                {onCreate && (
                    <button
                        type="button"
                        disabled={creating}
                        onClick={onCreate}
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                    >
                        <Plus size={16} />
                        {creating ? '하위 페이지 생성 중…' : '하위 페이지 추가'}
                    </button>
                )}
            </div>
        </section>
    );
}
