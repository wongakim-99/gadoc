'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Search, X } from 'lucide-react';
import { documentApi } from '@/lib/api-client';
import type { DocumentNode } from '@/src/entities/document/types';
import { getDocumentAncestors } from '@/src/entities/document/lib/getDocumentAncestors';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

export function DocumentLinkPicker({
    teamId,
    documentId,
    onSelect,
    onClose,
}: {
    teamId: string;
    documentId: string;
    onSelect: (document: DocumentNode) => void;
    onClose: () => void;
}) {
    const [documents, setDocuments] = useState<DocumentNode[]>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    const surface = useRef<HTMLDivElement>(null);
    const search = useRef<HTMLInputElement>(null);
    useDialogFocusTrap({ open: true, surfaceRef: surface, initialFocusRef: search, onEscape: onClose });
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setDocuments([]);
        void documentApi
            .getDocuments(teamId)
            .then((result) => {
                if (!result.success || !Array.isArray(result.data)) throw new Error('문서 목록을 불러오지 못했습니다.');
                if (active)
                    setDocuments(
                        (result.data as DocumentNode[]).filter(
                            (doc) =>
                                doc.teamId === teamId &&
                                doc.id !== documentId &&
                                !doc.archivedAt &&
                                !doc.isDatabasePage,
                        ),
                    );
            })
            .catch((caught) => {
                if (active) setError(caught instanceof Error ? caught.message : '문서 목록을 불러오지 못했습니다.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [teamId, documentId, attempt]);
    const filtered = documents.filter((doc) =>
        doc.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12dvh]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label="문서 링크 추가"
                tabIndex={-1}
                className="w-full max-w-xl overflow-hidden rounded-xl border border-border-primary bg-bg-primary shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
                    <h2 className="font-semibold">문서 링크 추가</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="문서 선택 닫기"
                        className="rounded p-1 hover:bg-bg-hover"
                    >
                        <X size={18} />
                    </button>
                </div>
                <label className="m-3 flex items-center gap-2 rounded-control border border-border-primary px-3 py-2">
                    <Search size={16} className="shrink-0 text-text-tertiary" />
                    <input
                        ref={search}
                        aria-label="연결할 문서 검색"
                        placeholder="연결할 문서 검색"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                </label>
                <div className="max-h-[48dvh] overflow-y-auto px-2 pb-3">
                    {loading ? (
                        <p role="status" className="p-4 text-sm">
                            문서를 불러오는 중입니다.
                        </p>
                    ) : error ? (
                        <p role="alert" className="p-4 text-sm text-error">
                            {error}{' '}
                            <button
                                type="button"
                                onClick={() => setAttempt((value) => value + 1)}
                                className="underline"
                            >
                                다시 시도
                            </button>
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="p-4 text-sm text-text-tertiary">연결할 수 있는 문서가 없습니다.</p>
                    ) : (
                        filtered.map((doc) => (
                            <button
                                type="button"
                                key={doc.id}
                                onClick={() => onSelect(doc)}
                                className="flex w-full items-start gap-3 rounded-control p-3 text-left hover:bg-bg-hover"
                            >
                                <FileText size={18} className="mt-0.5 shrink-0 text-text-secondary" />
                                <span className="min-w-0">
                                    <span className="block break-words text-sm font-medium">
                                        {doc.title || '제목 없음'}
                                    </span>
                                    <span className="block truncate text-xs text-text-tertiary">
                                        {getDocumentAncestors(documents, doc.id)
                                            .map((parent) => parent.title)
                                            .join(' / ') || '워크스페이스 문서'}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <p className="border-t border-border-primary px-4 py-3 text-xs text-text-tertiary">
                    접근 가능한 문서만 표시합니다. 원본을 복사하지 않고 링크로 연결합니다.
                </p>
            </div>
        </div>,
        document.body,
    );
}
