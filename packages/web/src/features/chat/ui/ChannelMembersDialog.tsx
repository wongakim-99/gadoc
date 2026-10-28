'use client';

import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, UsersRound, X } from 'lucide-react';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { reactionAvatarUrl } from '../model/reactionPeople';

const ROLE_LABELS = { owner: '소유자', admin: '관리자', member: '멤버', guest: '게스트' };

export function ChannelMembersDialog({
    members,
    channelName,
    channelType,
    currentUserId,
    onClose,
}: {
    members: TeamMemberSummary[];
    channelName: string;
    channelType?: string;
    currentUserId: string;
    onClose: () => void;
}) {
    const surface = useRef<HTMLDivElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const [query, setQuery] = useState('');
    useDialogFocusTrap({ open: true, surfaceRef: surface, initialFocusRef: search, onEscape: onClose });
    const visible = members.filter((member) =>
        (member.user?.username || '프로필을 확인할 수 없는 멤버')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
    );
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-3" onClick={onClose}>
            <div
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-panel border border-border-primary bg-bg-secondary shadow-2xl"
            >
                <header className="flex items-start justify-between gap-3 border-b border-border-primary px-5 py-4">
                    <div className="min-w-0">
                        <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold">
                            <UsersRound size={18} />
                            채널 참여자{' '}
                            <span className="text-sm font-normal text-text-tertiary">{members.length}명</span>
                        </h3>
                        <p className="mt-1 truncate text-xs text-text-secondary">#{channelName}</p>
                    </div>
                    <button
                        type="button"
                        aria-label="채널 참여자 닫기"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-hover"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="px-5 pt-4">
                    <label className="relative block">
                        <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-tertiary" />
                        <input
                            ref={search}
                            aria-label="채널 참여자 검색"
                            placeholder="이름으로 찾기"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-10 w-full rounded-lg border border-border-primary bg-bg-primary pr-3 pl-9 text-sm outline-none focus:border-text-tertiary"
                        />
                    </label>
                    <p className="my-3 text-xs leading-5 text-text-tertiary">
                        {['public', 'voice'].includes(channelType ?? '')
                            ? '이 채널에 접근할 수 있는 워크스페이스 멤버입니다.'
                            : '이 대화에 추가된 멤버만 표시됩니다.'}{' '}
                        현재 접속 여부를 나타내는 목록은 아닙니다.
                    </p>
                </div>
                <ul className="min-h-0 overflow-y-auto px-5 pb-4" aria-label="채널 멤버 목록">
                    {visible.map((member) => (
                        <li key={member.userId} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-2.5">
                            <MemberAvatar member={member} />
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {member.user?.username || '프로필을 확인할 수 없는 멤버'}
                                {member.userId === currentUserId && (
                                    <span className="ml-2 text-xs text-text-tertiary">나</span>
                                )}
                            </span>
                            <span className="shrink-0 text-xs text-text-tertiary">{ROLE_LABELS[member.role]}</span>
                        </li>
                    ))}
                    {!visible.length && (
                        <li className="py-8 text-center text-sm text-text-secondary">일치하는 멤버가 없습니다.</li>
                    )}
                </ul>
            </div>
        </div>,
        document.body,
    );
}

function MemberAvatar({ member }: { member: TeamMemberSummary }) {
    const [failed, setFailed] = useState<string | null>(null);
    const url = reactionAvatarUrl(member.user?.avatarUrl);
    return (
        <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(member.userId) }}
        >
            {url && failed !== url ? (
                <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(url)} />
            ) : (
                (member.user?.username || '?').slice(0, 1)
            )}
        </span>
    );
}
