'use client';
import Link from 'next/link';
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import { useState } from 'react';
import { LogOut, Settings, UserRound, Palette, ChevronRight } from 'lucide-react';
import { PopoverMenu } from '@/src/shared/ui/PopoverMenu';
import { ThemePreference } from '@/src/features/appearance/ThemePreference';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
interface Props { username: string; teamId: string; collapsed?: boolean; onLogout: () => Promise<void>; }
export function SidebarUserBar({ username, teamId, collapsed, onLogout }: Props) {
    const { me } = useTeamWorkspaceData(teamId);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const href = `/${teamId}/settings`;
    const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary';
    return <div className="flex min-w-0 items-center gap-1 p-2">
        <div className="min-w-0 flex-1">
            <PopoverMenu label="사용자 메뉴" width={292} placement="top" showHeader={false} open={open} onOpenChange={setOpen}
                triggerClassName="flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-bg-hover"
                icon={<>
                    <UserAvatar userId={me?.id ?? ""} name={username} size={36} />
                    <span className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
                        <span className="block truncate text-sm font-bold text-text-primary">{username || '사용자'}</span>
                        <span className="block text-[11px] text-text-tertiary">내 계정</span>
                    </span>
                </>}>
                <div className="flex items-center gap-3 border-b border-border-primary px-2 pb-3 pt-1">
                    <UserAvatar userId={me?.id ?? ""} name={username} size={44} />
                    <div className="min-w-0"><p className="truncate font-bold text-text-primary">{username}</p><p className="mt-0.5 break-all text-xs text-text-tertiary" aria-label="내 계정 이메일">{me?.email || '계정 확인 중'}</p></div>
                </div>
                <div>
                    <Link href={`${href}?section=account`} onClick={() => setOpen(false)} className={row}><UserRound size={17} />내 계정<ChevronRight size={14} className="ml-auto" /></Link>
                    <Link href={`${href}?section=appearance`} onClick={() => setOpen(false)} className={row}><Palette size={17} />환경설정<ChevronRight size={14} className="ml-auto" /></Link>
                    <Link href={href} onClick={() => setOpen(false)} className={row}><Settings size={17} />워크스페이스 설정</Link>
                </div>
                <div className="border-t border-border-primary px-2 pt-1"><ThemePreference /></div>
                <div className="border-t border-border-primary pt-1">
                    <button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onLogout(); } catch { setError('로그아웃하지 못했습니다. 다시 시도해 주세요.'); } finally { setBusy(false); } }} className={`${row} text-error disabled:opacity-50`}><LogOut size={17} />{busy ? '로그아웃 중…' : '로그아웃'}</button>
                    {error && <p role="alert" className="px-3 text-xs text-error">{error}</p>}
                </div>
            </PopoverMenu>
        </div>
        <Link href={`${href}?section=appearance`} aria-label="사용자 설정" title="사용자 설정" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary ${collapsed ? 'lg:hidden' : ''}`}><Settings size={18} /></Link>
    </div>;
}
