'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canLeaveWorkspacePane, useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { useDatabaseDraftGuard } from '../model/useDatabaseDraftGuard';

export function DatabasePageTitle({
    title,
    href,
    canEdit,
    onSave,
    showOpen = true,
    inputLabel,
    maxLength = 200,
    rowId,
    revision,
    disabled = false,
}: {
    title: string;
    href: string;
    canEdit: boolean;
    onSave: (title: string, revision?: number) => Promise<boolean>;
    showOpen?: boolean;
    inputLabel?: string;
    maxLength?: number;
    rowId?: string;
    revision?: number;
    disabled?: boolean;
}) {
    const [draft, setDraft] = useState(title);
    const [saving, setSaving] = useState(false);
    const dirty = useRef(false);
    const draftRevision = useRef(revision);
    const pending = useRef<Promise<boolean> | null>(null);
    const connection = useWorkspaceConnection();
    const router = useRouter();
    useEffect(() => {
        if (!dirty.current) setDraft(title);
    }, [title]);
    const save = () => {
        if (pending.current) return pending.current;
        if (draft === title) {
            dirty.current = false;
            return Promise.resolve(true);
        }
        if (!canEdit || !dirty.current) return Promise.resolve(true);
        setSaving(true);
        const next = draft.trim() || '제목 없음';
        const task = onSave(next, draftRevision.current)
            .then((ok) => {
                if (ok) {
                    dirty.current = false;
                    setDraft(next);
                }
                return ok;
            })
            .finally(() => {
                pending.current = null;
                setSaving(false);
            });
        pending.current = task;
        return task;
    };
    useDatabaseDraftGuard(() => dirty.current || !!pending.current, save);
    return (
        <div className="group/title flex w-full min-w-0 items-center gap-1">
            {canEdit ? (
                <input
                    data-page-name={rowId ?? href.split('/').at(-1)}
                    aria-label={inputLabel ?? `${title} 페이지 이름`}
                    value={draft}
                    disabled={saving || disabled}
                    maxLength={maxLength}
                    className="min-w-0 flex-1 rounded-control bg-transparent p-1 text-sm outline-none focus:ring-1 focus:ring-action"
                    onChange={(event) => {
                        if (!dirty.current) draftRevision.current = revision;
                        dirty.current = true;
                        setDraft(event.target.value);
                    }}
                    onBlur={() => void save()}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                    }}
                />
            ) : (
                <span className="min-w-0 flex-1 truncate">{title}</span>
            )}
            {showOpen && (
                <a
                    data-manages-draft-navigation
                    href={href}
                    aria-label={title}
                    title="페이지 열기"
                    className="shrink-0 rounded-control px-2 py-1 opacity-0 group-hover/title:opacity-100 focus:opacity-100 text-xs text-text-secondary hover:bg-bg-hover focus:ring-1 focus:ring-action"
                    onClick={async (event) => {
                        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                        event.preventDefault();
                        if (!(await canLeaveWorkspacePane())) return;
                        if (connection) connection.open(href, draft);
                        else router.push(href);
                    }}
                >
                    열기 ↗
                </a>
            )}
        </div>
    );
}
