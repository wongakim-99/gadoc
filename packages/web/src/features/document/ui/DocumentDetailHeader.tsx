'use client';

import type { DocumentFull } from '@/src/entities/document/types';
import type { SaveStatus } from '../model/DocumentSaveQueue';

export function DocumentDetailHeader({
    doc,
    status,
    onRetry,
    onArchive,
}: {
    doc: DocumentFull;
    status: SaveStatus;
    onRetry: () => void;
    onArchive: () => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <span
                role="status"
                aria-live="polite"
                className={`text-xs ${status === 'error' ? 'text-red-300' : 'text-text-tertiary'}`}
            >
                {doc.canEdit === false
                    ? '읽기 전용'
                    : { saved: '저장됨', pending: '저장 대기 중…', saving: '저장 중…', error: '저장 실패' }[status]}
            </span>
            {status === 'error' && (
                <button onClick={onRetry} className="rounded px-2 py-1 text-xs text-red-300 hover:bg-bg-hover">
                    다시 시도
                </button>
            )}
            {doc.visibility === 'restricted' && <span className="text-xs text-warning">제한된 페이지</span>}
            {doc.canDelete !== false && (
                <button onClick={onArchive} className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover">
                    아카이브
                </button>
            )}
        </div>
    );
}
