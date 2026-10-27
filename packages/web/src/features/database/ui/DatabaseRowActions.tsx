'use client';
import { MoreHorizontal, Copy, ExternalLink, Link2, Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { DatabaseMenu } from './DatabaseMenu';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import type { DatabaseRow } from '../model/types';
export function DatabaseRowActions({
    teamId,
    row,
    open,
    onOpenChange,
    busy,
    onDuplicate,
    onArchive,
}: {
    teamId: string;
    row: DatabaseRow;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    busy: boolean;
    onDuplicate: () => Promise<void>;
    onArchive: () => Promise<void>;
}) {
    const [notice, setNotice] = useState('');
    const button =
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-bg-hover disabled:opacity-40';
    return (
        <DatabaseMenu
            label={`${row.title} 페이지 메뉴`}
            icon={<MoreHorizontal size={15} />}
            open={open}
            onOpenChange={onOpenChange}
            triggerClassName={`shrink-0 rounded p-1 text-text-tertiary hover:bg-bg-hover focus:opacity-100 ${open ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}
        >
            <ResourceNavigation href={`/${teamId}/docs/${row.documentId}`} title={row.title} />
            <a className={button} href={`/${teamId}/docs/${row.documentId}`}>
                <ExternalLink size={14} />
                전체 페이지로 열기
            </a>
            <button
                type="button"
                className={button}
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(`${location.origin}/${teamId}/docs/${row.documentId}`);
                        setNotice('링크를 복사했습니다.');
                    } catch {
                        setNotice('링크를 복사하지 못했습니다.');
                    }
                }}
            >
                <Link2 size={14} />
                링크 복사
            </button>
            {row.canEdit && (
                <>
                    <button
                        type="button"
                        disabled={busy}
                        className={button}
                        onClick={() => {
                            onOpenChange(false);
                            requestAnimationFrame(() => {
                                const input = document.querySelector<HTMLInputElement>(
                                    `[data-page-name="${row.documentId}"]`,
                                );
                                input?.focus();
                                input?.select();
                            });
                        }}
                    >
                        <Pencil size={14} />
                        이름 바꾸기
                    </button>
                    <button type="button" disabled={busy} className={button} onClick={() => void onDuplicate()}>
                        <Copy size={14} />
                        복제
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        className={`${button} text-error`}
                        onClick={() => void onArchive()}
                    >
                        <Trash2 size={14} />
                        휴지통으로 이동
                    </button>
                </>
            )}
            {notice && (
                <p role="status" className="text-xs text-text-secondary">
                    {notice}
                </p>
            )}
        </DatabaseMenu>
    );
}
