'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import type { Reaction } from '@/src/entities/message/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { teamApi, unwrapApiArray } from '@/lib/api-client';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import { reactionPeople } from '../model/reactionPeople';

export function ReactionPeopleDialog({
    reactions,
    teamId,
    currentUserId,
    onClose,
}: {
    reactions: Reaction[];
    teamId: string;
    currentUserId: string;
    onClose: () => void;
}) {
    const surface = useRef<HTMLDivElement>(null);
    useDialogFocusTrap({ open: true, surfaceRef: surface, onEscape: onClose });
    const [members, setMembers] = useState<TeamMemberSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [filter, setFilter] = useState<string | null>(null);
    const active = reactions.some((reaction) => reaction.emoji === filter) ? filter : null;
    useEffect(() => {
        let current = true;
        setLoading(true);
        setError('');
        // One permission-checked lookup per open dialog, never one request per reaction/message.
        teamApi
            .getMembers(teamId)
            .then((result) => {
                if (!result.success) throw new Error();
                if (current) setMembers(unwrapApiArray<TeamMemberSummary>(result));
            })
            .catch(() => {
                if (current) {
                    setMembers([]);
                    setError('참여자 정보를 불러오지 못했습니다. 접근 권한을 확인하고 다시 시도해 주세요.');
                }
            })
            .finally(() => {
                if (current) setLoading(false);
            });
        return () => {
            current = false;
        };
    }, [teamId, reload]);
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-3" onClick={onClose}>
            <div
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label="리액션 참여자"
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-panel border border-border-primary bg-bg-secondary shadow-2xl"
            >
                <header className="flex items-center justify-between border-b border-border-primary px-5 py-4">
                    <h3 className="text-base font-semibold">리액션 참여자</h3>
                    <button
                        type="button"
                        aria-label="참여자 새로고침"
                        disabled={loading}
                        onClick={() => setReload((value) => value + 1)}
                        className="ml-auto mr-1 rounded-control p-1.5 text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label="리액션 참여자 닫기"
                        onClick={onClose}
                        className="rounded-control p-1.5 text-text-secondary hover:bg-bg-hover"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div aria-label="리액션 종류" className="flex flex-wrap gap-2 border-b border-border-primary px-5 py-3">
                    <button
                        type="button"
                        aria-pressed={!active}
                        onClick={() => setFilter(null)}
                        className={`rounded-control border px-2 py-1 text-xs ${!active ? 'border-action text-action-text' : 'border-border-primary text-text-secondary'}`}
                    >
                        전체
                    </button>
                    {reactions.map((reaction) => (
                        <button
                            type="button"
                            key={reaction.emoji}
                            aria-pressed={active === reaction.emoji}
                            onClick={() => setFilter(reaction.emoji)}
                            className={`rounded-control border px-2 py-1 text-xs ${active === reaction.emoji ? 'border-action text-action-text' : 'border-border-primary text-text-secondary'}`}
                        >
                            {reaction.emoji} {new Set(reaction.userIds).size}
                        </button>
                    ))}
                </div>
                <div className="min-h-0 overflow-y-auto px-5 py-4" aria-live="polite">
                    {loading ? (
                        <p role="status" className="text-sm text-text-secondary">
                            참여자를 불러오는 중...
                        </p>
                    ) : error ? (
                        <p role="alert" className="text-sm text-error">
                            {error}
                            <button
                                type="button"
                                className="ml-2 underline"
                                onClick={() => setReload((value) => value + 1)}
                            >
                                다시 시도
                            </button>
                        </p>
                    ) : reactions.length === 0 ? (
                        <p className="text-sm text-text-secondary">아직 리액션이 없습니다.</p>
                    ) : (
                        reactions
                            .filter((reaction) => !active || reaction.emoji === active)
                            .map((reaction) => {
                                const people = reactionPeople(reaction, members);
                                return (
                                    <section
                                        key={reaction.emoji}
                                        aria-label={`${reaction.emoji} 참여자`}
                                        className="mb-4 last:mb-0"
                                    >
                                        <h4 className="mb-2 flex items-center gap-2 text-sm">
                                            <span className="text-xl" aria-hidden="true">
                                                {reaction.emoji}
                                            </span>
                                            <span>{people.length}명</span>
                                        </h4>
                                        <ul className="space-y-2">
                                            {people.map((person) => (
                                                <li key={person.id} className="flex min-w-0 items-center gap-3 py-1">
                                                    <ParticipantAvatar
                                                        id={person.id}
                                                        name={person.name}
                                                        url={person.avatarUrl}
                                                    />
                                                    <span className="min-w-0 break-words text-sm">{person.name}</span>
                                                    {person.id === currentUserId && (
                                                        <span className="shrink-0 text-xs text-text-tertiary">나</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                );
                            })
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ParticipantAvatar({ id, name, url }: { id: string; name: string; url: string | null }) {
    const [failed, setFailed] = useState<string | null>(null);
    return (
        <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(id) }}
        >
            {url && url !== failed ? (
                <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(url)} />
            ) : (
                name.slice(0, 1)
            )}
        </span>
    );
}
