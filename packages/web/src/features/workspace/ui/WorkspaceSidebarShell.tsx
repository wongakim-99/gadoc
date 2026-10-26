'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
    BookOpen,
    Home,
    MessageSquare,
    ListTodo,
    Megaphone,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Settings,
    Trash2,
    ChevronsUpDown,
    Menu,
} from 'lucide-react';
import { NotificationBell } from '@/src/features/notification/ui/NotificationBell';
import { SidebarUserBar } from './SidebarUserBar';
import { workspaceAreaLabels, type WorkspaceArea } from '../model/workspaceNavigation';

export function WorkspaceSidebarShell({
    teamId,
    teamName,
    area,
    context,
    channelId,
    canAdmin,
    username,
    onLogout,
    onSearch,
    searchButtonRef,
    isDesktopMac,
}: {
    teamId: string;
    teamName: string;
    area: WorkspaceArea;
    context: ReactNode;
    channelId?: string;
    canAdmin: boolean;
    username: string;
    onLogout: () => Promise<void>;
    onSearch: () => void;
    searchButtonRef: RefObject<HTMLButtonElement | null>;
    isDesktopMac: boolean;
}) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => setMobileOpen(false), [pathname]);
    const sections = [
        { area: 'home', href: `/${teamId}`, icon: Home },
        {
            area: 'channel',
            href: channelId ? `/${teamId}/channel/${channelId}` : `/${teamId}/channel`,
            icon: MessageSquare,
        },
        { area: 'docs', href: `/${teamId}/docs`, icon: BookOpen },
        { area: 'issues', href: `/${teamId}/issues`, icon: ListTodo },
        { area: 'announcements', href: `/${teamId}/announcements`, icon: Megaphone },
    ] as const;
    const hideCollapsed = collapsed ? 'lg:hidden' : '';
    return (
        <aside
            aria-label="워크스페이스 사이드바"
            className={`flex shrink-0 flex-col border-b border-border-primary bg-bg-secondary lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
        >
            <div
                className={`flex min-h-14 shrink-0 items-center gap-2 border-b border-border-primary px-3 ${isDesktopMac ? 'lg:min-h-[92px] lg:pt-10 desktop-drag-region' : ''}`}
            >
                <Link
                    href="/dashboard"
                    aria-label="Slacord 홈"
                    title="Slacord · 워크스페이스 목록"
                    className={`shrink-0 rounded-md ${collapsed ? 'lg:hidden' : ''}`}
                >
                    <Image src="/logo.svg" alt="Slacord" width={32} height={32} />
                </Link>
                <Link
                    href="/dashboard"
                    title="워크스페이스 전환"
                    aria-label={`${teamName} · 워크스페이스 전환`}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold ${hideCollapsed}`}
                >
                    <span className="min-w-0">
                        <span className="block text-[10px] font-medium tracking-wide text-text-tertiary">SLACORD</span>
                        <span className="block truncate">{teamName}</span>
                    </span>
                    <ChevronsUpDown size={14} className="shrink-0 text-text-tertiary" />
                </Link>
                <button
                    type="button"
                    aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                    aria-expanded={!collapsed}
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden rounded p-2 text-text-secondary hover:bg-bg-hover lg:block"
                >
                    {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <button
                    type="button"
                    aria-label="워크스페이스 탐색"
                    aria-expanded={mobileOpen}
                    aria-controls="workspace-navigation"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="flex items-center gap-2 rounded p-2 text-sm text-text-secondary lg:hidden"
                >
                    {workspaceAreaLabels[area]}
                    <Menu size={18} />
                </button>
            </div>
            <div
                id="workspace-navigation"
                className={`${mobileOpen ? 'flex' : 'hidden'} max-h-[80dvh] min-h-0 flex-col overflow-auto lg:flex lg:max-h-none lg:flex-1 lg:overflow-hidden`}
            >
                <div className="shrink-0 px-3 pt-2">
                    <button
                        ref={searchButtonRef}
                        onClick={() => {
                            setMobileOpen(false);
                            onSearch();
                        }}
                        aria-label="전체 검색"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-text-secondary hover:bg-bg-hover"
                    >
                        <Search size={16} className="shrink-0" />
                        <span className={hideCollapsed}>전체 검색</span>
                        <span className={`ml-auto text-[10px] ${hideCollapsed}`}>
                            {isDesktopMac ? '⌘ K' : 'Ctrl K'}
                        </span>
                    </button>
                    <div className={hideCollapsed}>
                        <NotificationBell teamId={teamId} />
                    </div>
                </div>
                <nav
                    aria-label="워크스페이스 영역"
                    className={`flex shrink-0 flex-col gap-0.5 border-b border-border-primary px-3 py-2 ${collapsed ? 'lg:px-2' : ''}`}
                >
                    {sections.map(({ area: target, href, icon: Icon }) => (
                        <Link
                            key={target}
                            href={href}
                            title={workspaceAreaLabels[target]}
                            aria-label={workspaceAreaLabels[target]}
                            aria-current={area === target ? 'location' : undefined}
                            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition hover:bg-bg-hover ${collapsed ? 'lg:justify-center' : ''} ${area === target ? 'bg-bg-active font-medium text-text-primary' : 'text-text-secondary'}`}
                        >
                            <Icon size={16} className="shrink-0" />
                            <span className={hideCollapsed}>{workspaceAreaLabels[target]}</span>
                        </Link>
                    ))}
                </nav>
                <nav
                    aria-label={`${workspaceAreaLabels[area]} 탐색`}
                    className={`min-h-0 flex-1 overflow-y-auto px-3 py-4 ${hideCollapsed}`}
                >
                    {context}
                </nav>
                <div className={`mt-auto shrink-0 border-t border-border-primary ${collapsed ? 'lg:pt-2' : ''}`}>
                    <div
                        className={`flex items-center gap-1 px-3 py-2 text-xs text-text-secondary ${collapsed ? 'lg:flex-col lg:px-1' : ''}`}
                    >
                        {canAdmin && (
                            <Link
                                href={`/${teamId}/docs/archived`}
                                title="문서 휴지통"
                                aria-label="문서 휴지통"
                                aria-current={pathname === `/${teamId}/docs/archived` ? 'page' : undefined}
                                className="flex items-center gap-1 rounded p-2 hover:bg-bg-hover"
                            >
                                <Trash2 size={14} />
                                <span className={hideCollapsed}>휴지통</span>
                            </Link>
                        )}
                        <Link
                            href={`/${teamId}/settings`}
                            title="설정"
                            aria-label="설정"
                            aria-current={area === 'settings' ? 'page' : undefined}
                            className={`flex items-center gap-1 rounded p-2 hover:bg-bg-hover ${area === 'settings' ? 'bg-bg-active text-text-primary' : ''}`}
                        >
                            <Settings size={14} />
                            <span className={hideCollapsed}>설정</span>
                        </Link>
                    </div>
                    <div className={hideCollapsed}>
                        <SidebarUserBar username={username} onLogout={onLogout} />
                    </div>
                </div>
            </div>
        </aside>
    );
}
