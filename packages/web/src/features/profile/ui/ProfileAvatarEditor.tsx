'use client';

import { useEffect, useRef, useState } from 'react';
import { authApi } from '@/lib/api-client';
import { useProfileStore, useUserIdentity } from '@/src/entities/user/model/profile.store';
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import { avatarFileError, AVATAR_MAX_SIDE, AVATAR_MIME_TYPES } from '@/src/shared/lib/avatar-image';

export function ProfileAvatarEditor({ userId, username }: { userId: string; username: string }) {
    const identity = useUserIdentity(userId, username);
    const input = useRef<HTMLInputElement>(null);
    const selection = useRef(0);
    const [draft, setDraft] = useState<{ file: File; url: string } | null>(null);
    const [busy, setBusy] = useState<'upload' | 'delete' | 'select' | null>(null);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [failedAction, setFailedAction] = useState<'upload' | 'delete' | null>(null);
    useEffect(
        () => () => {
            if (draft) URL.revokeObjectURL(draft.url);
        },
        [draft],
    );
    useEffect(
        () => () => {
            selection.current++;
        },
        [],
    );

    const select = async (file?: File) => {
        if (!file) return;
        const fileError = avatarFileError(file);
        if (fileError) {
            setError(fileError);
            return;
        }
        const serial = ++selection.current;
        const url = URL.createObjectURL(file);
        setBusy('select');
        setError('');
        setStatus('');
        setFailedAction(null);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            if (
                !image.naturalWidth ||
                !image.naturalHeight ||
                image.naturalWidth > AVATAR_MAX_SIDE ||
                image.naturalHeight > AVATAR_MAX_SIDE
            ) {
                throw new Error('size');
            }
            if (serial !== selection.current) {
                URL.revokeObjectURL(url);
                return;
            }
            setDraft({ file, url });
        } catch (caught) {
            URL.revokeObjectURL(url);
            if (serial === selection.current)
                setError(
                    caught instanceof Error && caught.message === 'size'
                        ? '프로필 이미지는 가로·세로 각각 2048픽셀 이하여야 합니다.'
                        : '이미지를 읽지 못했습니다. 다른 이미지를 선택해 주세요.',
                );
        } finally {
            if (serial === selection.current) setBusy(null);
        }
    };

    const save = async (action: 'upload' | 'delete') => {
        if (busy || (action === 'upload' && !draft)) return;
        setBusy(action);
        setError('');
        setStatus('');
        setFailedAction(null);
        try {
            const response =
                action === 'upload' ? await authApi.uploadAvatar(draft!.file) : await authApi.deleteAvatar();
            if (!response.success || !response.data) throw new Error();
            useProfileStore.getState().apply([response.data]);
            if (action === 'upload') setDraft(null);
            setStatus(action === 'upload' ? '프로필 이미지를 저장했습니다.' : '프로필 이미지를 삭제했습니다.');
        } catch {
            setFailedAction(action);
            setError(
                action === 'upload'
                    ? '이미지를 저장하지 못했습니다. 기존 프로필과 선택한 이미지를 유지했습니다. 다시 시도해 주세요.'
                    : '이미지를 삭제하지 못했습니다. 기존 프로필과 선택한 이미지를 유지했습니다. 다시 시도해 주세요.',
            );
        } finally {
            setBusy(null);
        }
    };

    const button =
        'rounded-lg border border-border-primary px-3 py-2 text-sm text-text-primary hover:bg-bg-hover disabled:cursor-wait disabled:opacity-50';
    return (
        <section
            aria-label="프로필 이미지 편집"
            aria-busy={Boolean(busy)}
            className="mt-5 rounded-lg border border-border-primary bg-bg-primary p-4"
        >
            <h3 className="font-bold text-text-primary">프로필 이미지</h3>
            <p id="avatar-help" className="mt-1 text-xs leading-5 text-text-secondary">
                모든 워크스페이스에 적용됩니다. PNG, JPEG, WebP, GIF · 최대 2MB · 2048×2048픽셀 · 움직이는 이미지는
                100프레임, 전체 1600만 픽셀 이내
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="text-center">
                    <UserAvatar userId={userId} name={username} size={64} label="현재 프로필 이미지" />
                    <p className="mt-1 text-xs text-text-secondary">현재 이미지</p>
                </div>
                {draft && (
                    <div className="text-center">
                        <img
                            src={draft.url}
                            alt="선택한 프로필 이미지 미리보기"
                            className="h-16 w-16 rounded-full object-cover"
                        />
                        <p className="mt-1 text-xs text-text-secondary">저장 전 미리보기</p>
                    </div>
                )}
            </div>
            <input
                ref={input}
                type="file"
                tabIndex={-1}
                aria-label="프로필 이미지 선택"
                aria-describedby="avatar-help"
                accept={AVATAR_MIME_TYPES.join(',')}
                disabled={Boolean(busy) || !userId}
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void select(file);
                }}
            />
            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={Boolean(busy) || !userId}
                    onClick={() => input.current?.click()}
                    className={button}
                >
                    {busy === 'select' ? '이미지 확인 중…' : '이미지 선택'}
                </button>
                {draft && (
                    <>
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void save('upload')}
                            className="rounded-lg bg-action px-3 py-2 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-50"
                        >
                            {busy === 'upload' ? '저장 중…' : failedAction === 'upload' ? '다시 저장' : '이미지 저장'}
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => {
                                setDraft(null);
                                setError('');
                                setFailedAction(null);
                            }}
                            className={button}
                        >
                            선택 취소
                        </button>
                    </>
                )}
                {identity.avatarUrl && (
                    <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void save('delete')}
                        className={`${button} text-error`}
                    >
                        {busy === 'delete' ? '삭제 중…' : failedAction === 'delete' ? '다시 삭제' : '이미지 삭제'}
                    </button>
                )}
            </div>
            {error && (
                <p role="alert" className="mt-3 text-sm text-error">
                    {error}
                </p>
            )}
            <p role="status" aria-live="polite" className="mt-2 text-sm text-text-secondary">
                {status}
            </p>
        </section>
    );
}
