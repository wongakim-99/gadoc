'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { channelApi } from '@/lib/api-client';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

export function ChannelArchiveDialog({
    teamId,
    channelId,
    name,
    archived,
    onClose,
}: {
    teamId: string;
    channelId: string;
    name: string;
    archived: boolean;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
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
    const save = async () => {
        setBusy(true);
        setError('');
        try {
            await channelApi.archiveChannel(teamId, channelId, !archived);
            window.dispatchEvent(new CustomEvent('gadoc:channels-changed', { detail: { teamId } }));
            onClose();
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
                    #{name} {archived ? '복원' : '보관'}
                </h2>
                <p className="mt-3 text-sm text-text-secondary">
                    {archived
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
                        onClick={onClose}
                        className="rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void save()}
                        className="rounded-lg bg-action px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {busy ? '처리 중…' : archived ? '채널 복원' : '채널 보관'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
