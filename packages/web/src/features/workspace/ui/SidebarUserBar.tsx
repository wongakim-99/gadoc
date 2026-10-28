'use client';
import Link from 'next/link';
import { LogOut, Settings, ChevronUp } from 'lucide-react';
import { PopoverMenu } from '@/src/shared/ui/PopoverMenu';
interface Props {
    username: string;
    teamId: string;
    collapsed?: boolean;
    onLogout: () => Promise<void>;
}
export function SidebarUserBar({ username, teamId, collapsed, onLogout }: Props) {
    return (
        <div className="p-2">
            <PopoverMenu
                label="사용자 메뉴"
                triggerClassName="flex w-full min-w-0 items-center gap-2 rounded-control p-2 text-left hover:bg-bg-hover"
                icon={
                    <>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-selection text-sm font-semibold text-action-text">
                            {username.slice(0, 1) || '?'}
                        </span>
                        <span
                            className={'min-w-0 flex-1 truncate text-sm font-medium ' + (collapsed ? 'lg:hidden' : '')}
                        >
                            {username || '사용자'}
                        </span>
                        <ChevronUp
                            size={14}
                            className={'shrink-0 text-text-tertiary ' + (collapsed ? 'lg:hidden' : '')}
                        />
                    </>
                }
            >
                <p className="truncate font-medium">{username}</p>
                <Link
                    href={'/' + teamId + '/settings'}
                    className="flex items-center gap-2 rounded-control p-2 hover:bg-bg-hover"
                >
                    <Settings size={16} />
                    설정
                </Link>
                <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="flex w-full items-center gap-2 rounded-control p-2 text-error hover:bg-bg-hover"
                >
                    <LogOut size={16} />
                    로그아웃
                </button>
            </PopoverMenu>
        </div>
    );
}
