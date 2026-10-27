'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, MessageSquare, ListTodo, Megaphone, X } from 'lucide-react';
import { documentApi, channelApi, issueApi, announcementApi, unwrapApiArray } from '@/lib/api-client';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import type { WorkspaceReference } from '../model/workspaceReference';

const kinds = {
    docs: { label: '문서', icon: BookOpen },
    channel: { label: '대화', icon: MessageSquare },
    issues: { label: '이슈', icon: ListTodo },
    announcements: { label: '공지', icon: Megaphone },
};

export function WorkspaceResourcePicker({
    teamId,
    onSelect,
    onClose,
}: {
    teamId: string;
    onSelect: (reference: WorkspaceReference) => void;
    onClose: () => void;
}) {
    const [items, setItems] = useState<WorkspaceReference[]>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<keyof typeof kinds>('docs');
    const surface = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    useDialogFocusTrap({ open: true, onEscape: onClose, surfaceRef: surface, initialFocusRef: input });
    useEffect(() => {
        let active = true;
        Promise.allSettled([
            documentApi.getDocuments(teamId),
            channelApi.getChannels(teamId),
            issueApi.getIssues(teamId),
            announcementApi.getAnnouncements(teamId),
        ]).then((results) => {
            if (!active) return;
            const list: WorkspaceReference[] = [];
            const resourceKinds = ['docs', 'channel', 'issues', 'announcements'] as const;
            let failed = false;
            results.forEach((result, index) => {
                if (result.status === 'rejected' || !result.value.success) {
                    failed = true;
                    return;
                }
                const type = resourceKinds[index];
                unwrapApiArray<{ id: string; title?: string; name?: string }>(result.value).forEach((item) =>
                    list.push({
                        kind: type,
                        label: item.title || item.name || kinds[type].label,
                        href:
                            type === 'issues'
                                ? `/${teamId}/issues?issue=${encodeURIComponent(item.id)}`
                                : type === 'announcements'
                                  ? `/${teamId}/announcements?announcement=${encodeURIComponent(item.id)}`
                                  : `/${teamId}/${type}/${item.id}`,
                    }),
                );
            });
            setItems(list);
            setLoading(false);
            if (failed) setError('일부 목록을 불러오지 못했습니다. 닫은 뒤 다시 시도해 주세요.');
        });
        return () => {
            active = false;
        };
    }, [teamId]);
    const filtered = items.filter(
        (item) => item.kind === kind && item.label.toLowerCase().includes(query.toLowerCase()),
    );
    return (
        <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-overlay px-4 pt-[12vh] backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label="옆에 열 내용 선택"
                tabIndex={-1}
                className="w-full max-w-xl rounded-panel border border-border-primary bg-bg-secondary shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
                    <div>
                        <h2 className="font-semibold">옆에 열기</h2>
                        <p className="mt-1 text-xs text-text-tertiary">
                            현재 작업을 유지하면서 관련 내용을 확인하세요.
                        </p>
                    </div>
                    <button className="connection-icon" aria-label="선택 창 닫기" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4">
                    <input
                        ref={input}
                        aria-label="연결할 내용 검색"
                        placeholder="제목으로 찾기"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm"
                    />
                    <div className="my-3 flex gap-1" role="group" aria-label="내용 종류">
                        {Object.entries(kinds).map(([key, value]) => (
                            <button
                                key={key}
                                aria-pressed={kind === key}
                                onClick={() => setKind(key as keyof typeof kinds)}
                                className="flex items-center gap-2 rounded-control px-3 py-2 text-xs text-text-secondary aria-pressed:bg-selection aria-pressed:text-action-text"
                            >
                                <value.icon size={14} />
                                {value.label}
                            </button>
                        ))}
                    </div>
                    <div className="max-h-[40vh] overflow-auto">
                        {loading ? (
                            <p role="status" className="p-4 text-sm text-text-tertiary">
                                목록을 불러오는 중…
                            </p>
                        ) : filtered.length ? (
                            filtered.map((item) => (
                                <button
                                    key={item.href}
                                    onClick={() => onSelect(item)}
                                    className="flex w-full items-center justify-between rounded-control px-3 py-3 text-left text-sm hover:bg-bg-hover"
                                >
                                    <span className="truncate">{item.label}</span>
                                    <span className="ml-3 shrink-0 text-xs text-text-tertiary">옆에 열기 ↗</span>
                                </button>
                            ))
                        ) : (
                            <p className="p-4 text-sm text-text-tertiary">표시할 {kinds[kind].label}가 없습니다.</p>
                        )}
                    </div>
                    {error && (
                        <p role="alert" className="mt-2 text-xs text-warning">
                            {error}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
