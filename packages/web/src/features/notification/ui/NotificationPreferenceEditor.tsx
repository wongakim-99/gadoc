'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, notificationApi, unwrapApiData } from '@/lib/api-client';
import type { NotificationKind, NotificationMode, NotificationPreference } from '@/src/entities/notification/types';

const modeLabels = {
    all: '모든 활동',
    mentions: '멘션·DM·내 관련 활동만',
    off: '데스크톱 알림 끄기',
    inherit: '워크스페이스 기본 설정 따르기',
};
const kindLabels: Record<NotificationKind, string> = {
    mention: '멘션',
    thread: '스레드 답글',
    issue: '이슈 할당',
    document: '문서 할당',
    chat: '일반 채팅·DM',
    update: '업데이트',
};
const kindKeys = Object.keys(kindLabels) as NotificationKind[];
type Choice = 'inherit' | 'on' | 'off';
interface Draft {
    mode: NotificationMode | 'inherit';
    kinds: Record<NotificationKind, Choice>;
}
function toDraft(value: NotificationPreference, channelId?: string): Draft {
    return {
        mode: channelId ? (value.channelModes[channelId] ?? 'inherit') : value.mode,
        kinds: Object.fromEntries(
            kindKeys.map((kind) => {
                const enabled = channelId ? value.channelKinds[channelId]?.[kind] : value.kinds[kind];
                return [kind, enabled === undefined ? 'inherit' : enabled ? 'on' : 'off'];
            }),
        ) as Draft['kinds'],
    };
}

export function NotificationPreferenceEditor({
    teamId,
    channelId,
    syncedValue,
    onSaved,
}: {
    teamId: string;
    channelId?: string;
    syncedValue?: NotificationPreference | null;
    onSaved?: (value: NotificationPreference) => void;
}) {
    const [stored, setStored] = useState<{ key: string; value: NotificationPreference } | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [notice, setNotice] = useState('');
    const [reload, setReload] = useState(0);
    const sequence = useRef(0);
    const pending = useRef(false);
    const dirty = useRef(false);
    const latest = useRef<NotificationPreference | null>(null);
    const key = `${teamId}:${channelId ?? ''}`;
    const current = stored?.key === key ? stored.value : null;

    useEffect(() => {
        const request = ++sequence.current;
        setError('');
        setNotice('');
        setConflict(false);
        setStored(null);
        setDraft(null);
        setBusy(false);
        pending.current = false;
        dirty.current = false;
        latest.current = null;
        notificationApi
            .getPreferences(teamId)
            .then((result) => {
                const value = unwrapApiData<NotificationPreference>(result);
                if (!result.success || !value) throw new Error('알림 설정을 불러오지 못했습니다.');
                if (request !== sequence.current || (latest.current && latest.current.revision > value.revision))
                    return;
                latest.current = value;
                setStored({ key, value });
                if (!dirty.current) setDraft(toDraft(value, channelId));
            })
            .catch(() => {
                if (request === sequence.current) setError('알림 설정을 불러오지 못했습니다. 다시 시도해 주세요.');
            });
        return () => {
            ++sequence.current;
        };
    }, [teamId, channelId, key, reload]);

    useEffect(() => {
        if (!syncedValue || (latest.current && syncedValue.revision <= latest.current.revision)) return;
        latest.current = syncedValue;
        setStored({ key, value: syncedValue });
        if (!dirty.current) setDraft(toDraft(syncedValue, channelId));
    }, [syncedValue, key, channelId]);

    const save = async (reset = false) => {
        if (!current || !draft || pending.current || conflict) return;
        pending.current = true;
        const request = sequence.current;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await notificationApi.updatePreferences(
                teamId,
                reset
                    ? {
                          channelId,
                          revision: current.revision,
                          reset: true,
                      }
                    : {
                          mode: draft.mode,
                          channelId,
                          revision: current.revision,
                          kinds: Object.fromEntries(
                              kindKeys.map((kind) => [
                                  kind,
                                  draft.kinds[kind] === 'inherit' ? 'inherit' : draft.kinds[kind] === 'on',
                              ]),
                          ),
                      },
            );
            const value = unwrapApiData<NotificationPreference>(result);
            if (!result.success || !value) throw new Error('알림 설정을 저장하지 못했습니다.');
            if (request !== sequence.current) return;
            latest.current = value;
            setStored({ key, value });
            dirty.current = false;
            setDraft(toDraft(value, channelId));
            setNotice(
                reset
                    ? '이 방의 모든 예외를 초기화했습니다. 워크스페이스 기본 설정을 따릅니다.'
                    : '이 계정의 데스크톱 알림 설정을 저장했습니다.',
            );
            onSaved?.(value);
        } catch (error) {
            if (request === sequence.current) {
                setConflict(error instanceof ApiError && error.status === 409);
                setError(error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.');
            }
        } finally {
            if (request === sequence.current) {
                setBusy(false);
                pending.current = false;
            }
        }
    };
    const edit = (next: Draft) => {
        dirty.current = true;
        setDraft(next);
        setNotice('');
    };
    const subject = channelId ? '이 방' : '워크스페이스';
    const effectiveMode = current ? (channelId && current.channelModes[channelId]) || current.mode : 'all';
    return (
        <section aria-label={`${subject} 알림 정책`} className="space-y-4 text-sm" aria-busy={busy}>
            {!current && !error && (
                <p role="status" className="text-text-secondary">
                    알림 설정을 불러오는 중...
                </p>
            )}
            {current && draft && (
                <>
                    <label className="block text-xs text-text-secondary">
                        {subject} 데스크톱 알림 방식
                        <select
                            aria-label={`${subject} 알림 방식`}
                            value={draft.mode}
                            disabled={busy}
                            onChange={(event) => edit({ ...draft, mode: event.target.value as Draft['mode'] })}
                            className="mt-2 w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary"
                        >
                            {(['inherit', 'all', 'mentions', 'off'] as const)
                                .filter((mode) => channelId || mode !== 'inherit')
                                .map((mode) => (
                                    <option key={mode} value={mode}>
                                        {modeLabels[mode]}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <p className="text-xs leading-5 text-text-secondary">
                        현재 저장된 방식: {modeLabels[effectiveMode]}
                    </p>
                    <fieldset className="space-y-3" disabled={busy}>
                        <legend className="mb-2 font-medium">{subject} 알림 종류</legend>
                        {kindKeys.map((kind) => {
                            const inherited = channelId && current.channelKinds[channelId]?.[kind] === undefined;
                            const enabled =
                                (channelId ? current.channelKinds[channelId]?.[kind] : undefined) ??
                                current.kinds[kind];
                            return (
                                <div key={kind} className="flex flex-wrap items-center justify-between gap-2">
                                    <label htmlFor={`${key}-${kind}`} className="min-w-24">
                                        {kindLabels[kind]}
                                    </label>
                                    {channelId ? (
                                        <select
                                            id={`${key}-${kind}`}
                                            aria-label={`${subject} ${kindLabels[kind]}`}
                                            value={draft.kinds[kind]}
                                            onChange={(event) =>
                                                edit({
                                                    ...draft,
                                                    kinds: { ...draft.kinds, [kind]: event.target.value as Choice },
                                                })
                                            }
                                            className="max-w-full rounded-control border border-border-primary bg-bg-primary px-2 py-1.5 text-xs"
                                        >
                                            <option value="inherit">
                                                기본 설정 따르기 ({current.kinds[kind] ? '받기' : '끄기'})
                                            </option>
                                            <option value="on">이 방에서 받기</option>
                                            <option value="off">이 방에서 끄기</option>
                                        </select>
                                    ) : (
                                        <input
                                            id={`${key}-${kind}`}
                                            type="checkbox"
                                            aria-label={`${subject} ${kindLabels[kind]}`}
                                            checked={draft.kinds[kind] === 'on'}
                                            onChange={(event) =>
                                                edit({
                                                    ...draft,
                                                    kinds: {
                                                        ...draft.kinds,
                                                        [kind]: event.target.checked ? 'on' : 'off',
                                                    },
                                                })
                                            }
                                            className="h-4 w-4 accent-action"
                                        />
                                    )}
                                    {channelId && (
                                        <span className="w-full text-right text-xs text-text-tertiary">
                                            저장됨: {inherited ? '기본 설정 · ' : '이 방의 예외 · '}
                                            {effectiveMode === 'off' ? '방식에서 모두 차단' : enabled ? '받기' : '끄기'}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </fieldset>
                    <p className="text-xs leading-5 text-text-secondary">
                        선택한 알림 방식 안에서 켜진 종류만 데스크톱에 표시합니다. 메시지는 멘션, 스레드 답글, 일반 채팅
                        순으로 한 종류에 분류됩니다. 업데이트는 이슈 변경 알림에 적용됩니다.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy || conflict}
                            onClick={() => void save()}
                            className="rounded-control bg-action px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                            {busy ? '저장 중...' : '알림 설정 저장'}
                        </button>
                        {channelId && (
                            <button
                                type="button"
                                disabled={busy || conflict}
                                onClick={() => void save(true)}
                                className="rounded-control border border-border-primary px-3 py-2 text-xs disabled:opacity-50"
                            >
                                이 방의 모든 예외 초기화
                            </button>
                        )}
                    </div>
                </>
            )}
            {error && (
                <div role="alert" className="space-y-2 text-xs text-error">
                    <p>{error}</p>
                    {current && (
                        <p>
                            저장하지 못한 선택은 유지됩니다.{conflict && ' 최신 설정을 불러온 뒤 다시 선택해 주세요.'}
                        </p>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            if (
                                current &&
                                dirty.current &&
                                !window.confirm('현재 선택을 버리고 최신 알림 설정을 불러올까요?')
                            )
                                return;
                            setReload((value) => value + 1);
                        }}
                        className="text-text-secondary underline"
                    >
                        최신 설정 다시 불러오기
                    </button>
                </div>
            )}
            {notice && (
                <p role="status" className="text-xs text-text-secondary">
                    {notice}
                </p>
            )}
        </section>
    );
}
