'use client';

import Link from 'next/link';
import { WorkspaceOpenButton } from './WorkspaceReferenceActions';
import { useWorkspaceDragSource } from '../model/useWorkspaceDragSource';

interface Props {
    href: string;
    label: string;
    active: boolean;
    icon?: React.ReactNode;
    unreadCount?: number;
    mentionCount?: number;
}

export function SidebarNavLink({ href, label, active, icon, unreadCount = 0, mentionCount = 0 }: Props) {
    const showMentionBadge = mentionCount > 0;
    const showUnreadBadge = !showMentionBadge && unreadCount > 0;
    const reference = { kind: 'channel' as const, href, label };
    const dragSource = useWorkspaceDragSource(reference);
    const isChannel = href.split('/')[2] === 'channel';

    return (
        <div className="group flex min-w-0 items-center gap-0.5">
            <Link
                href={href}
                {...(isChannel ? dragSource : {})}
                title="채널 열기 · 오른쪽 가장자리로 끌면 옆에 열기"
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                        ? 'bg-bg-active font-medium text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-white'
                }`}
            >
                {icon}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {showMentionBadge ? (
                    <span
                        title={`멘션 ${mentionCount}개`}
                        className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-action/20 bg-action/10 px-1 text-[10px] font-medium tabular-nums text-action-text"
                    >
                        @{mentionCount > 9 ? '9+' : mentionCount}
                    </span>
                ) : null}
                {showUnreadBadge ? (
                    <span
                        title={`읽지 않은 메시지 ${unreadCount}개`}
                        className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-bg-tertiary px-1 text-[10px] font-medium tabular-nums text-text-secondary"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                ) : null}
            </Link>
            {isChannel && <WorkspaceOpenButton reference={reference} />}
        </div>
    );
}
