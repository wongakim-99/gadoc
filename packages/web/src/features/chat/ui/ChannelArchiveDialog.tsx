'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { channelApi } from '@/lib/api-client';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { useRouter } from 'next/navigation';

export function ChannelArchiveDialog({
    teamId,
    channelId,
    name,
    archived,
    description = '',
    onClose,
}: {
    teamId: string;
    channelId: string;
    name: string;
    archived: boolean;
    description?: string;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [editedName, setEditedName] = useState(name);
    const [editedDescription, setEditedDescription] = useState(description);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const router = useRouter();
    const surfaceRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    useDialogFocusTrap({
        open: true,
        onEscape: () => {
            if (!busy) onClose();
        },
        surfaceRef,
        initialFocusRef: cancelRef,
    });
    const save = async (action: 'archive' | 'update' | 'delete') => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const result = action === 'delete' ? await channelApi.deleteChannel(teamId, channelId)
                : action === 'update' ? await channelApi.updateChannel(teamId, channelId, { name: editedName, description: editedDescription })
                : await channelApi.archiveChannel(teamId, channelId, !archived);
            if (!result.success) throw new Error('채널을 변경하지 못했습니다.');
            window.dispatchEvent(new CustomEvent('gadoc:channels-changed', { detail: { teamId } }));
            onClose();
            if (action === 'delete') router.replace(`/${teamId}/channel`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '채널을 변경하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div
                ref={surfaceRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="channel-archive-title"
                tabIndex={-1}
                className="w-full max-w-md rounded-xl border border-border-primary bg-bg-primary p-5 shadow-xl"
            >
                <h2 id="channel-archive-title" className="text-lg font-bold text-text-primary">
                    {confirmDelete ? '채널을 삭제할까요?' : `#${name} 채널 설정`}
                </h2>
                {!confirmDelete && <div className="mt-4 space-y-3">
                    <label className="block text-sm text-text-secondary">채널 이름
                        <input aria-label="채널 이름" disabled={busy} maxLength={100} value={editedName} onChange={(event) => setEditedName(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-text-primary" />
                    </label>
                    <label className="block text-sm text-text-secondary">채널 설명
                        <textarea aria-label="채널 설명" disabled={busy} maxLength={2000} value={editedDescription} onChange={(event) => setEditedDescription(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-text-primary" />
                    </label>
                    <button type="button" disabled={busy || !editedName.trim()} onClick={() => void save('update')}
                        className="rounded-lg bg-action px-4 py-2 text-sm text-white disabled:opacity-50">변경 저장</button>
                </div>}
                <p className="mt-3 text-sm text-text-secondary">
                    {confirmDelete ? '채널과 대화에 더 이상 접근할 수 없으며 복원할 수 없습니다. 연결된 문서와 이슈는 삭제하지 않습니다.' : archived
                        ? '복원하면 채널에서 다시 메시지를 작성할 수 있습니다.'
                        : '보관하면 일반 채널 목록에서 숨겨지고 읽기 전용으로 바뀝니다. 메시지와 연결된 자료는 유지되며 언제든 복원할 수 있습니다.'}
                </p>
                {error && (
                    <p role="alert" className="mt-3 text-sm text-red-400">
                        {error}
                    </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        disabled={busy}
                        onClick={() => confirmDelete ? setConfirmDelete(false) : onClose()}
                        className="rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void save(confirmDelete ? 'delete' : 'archive')}
                        className="rounded-lg bg-action px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {busy ? '처리 중…' : confirmDelete ? '영구 삭제' : archived ? '채널 복원' : '채널 보관'}
                    </button>
                    {!confirmDelete && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}
                        className="rounded-lg border border-border-primary px-4 py-2 text-sm text-error">채널 삭제</button>}
                </div>
            </div>
        </div>,
        document.body,
    );
}
