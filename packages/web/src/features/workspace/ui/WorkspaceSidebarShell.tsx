'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWorkspaceConnection } from '../model/useWorkspaceConnection';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
    BookOpen,
    Home,
    MessageSquare,
    ListTodo,
    Megaphone,
    ChevronLeft,
    ChevronRight,
    Search,
    Trash2,
    Menu,
} from 'lucide-react';
import { NotificationBell } from '@/src/features/notification/ui/NotificationBell';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarUserBar } from './SidebarUserBar';
import { useWorkspaceDragSource } from '../model/useWorkspaceDragSource';
import { WorkspaceOpenButton } from './WorkspaceReferenceActions';
import type { WorkspaceReference } from '../model/workspaceReference';
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
    const routePathname = usePathname();
    const pathname = useWorkspaceConnection()?.activePath ?? routePathname;
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
                data-testid="workspace-brand-header"
                className={`flex min-h-16 shrink-0 items-center gap-2.5 border-b border-border-primary px-4 ${isDesktopMac ? 'lg:min-h-[104px] lg:pt-10 desktop-drag-region' : ''}`}
            >
                <Link
                    href="/dashboard"
                    aria-label="GaDoc 홈"
                    title="GaDoc · 워크스페이스 목록"
                    className={`shrink-0 rounded-md ${collapsed ? 'lg:hidden' : ''}`}
                >
                    <Image src="/logo-workspace.svg" alt="GaDoc" width={32} height={32} />
                </Link>
                <div className={'min-w-0 flex-1 ' + hideCollapsed}>
                    <WorkspaceSwitcher teamId={teamId} teamName={teamName} />
                </div>
                <button
                    type="button"
                    aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                    aria-expanded={!collapsed}
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-bg-hover lg:inline-flex"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
                <div className="shrink-0 space-y-1 px-3 pb-1 pt-4">
                    <button
                        ref={searchButtonRef}
                        onClick={() => {
                            setMobileOpen(false);
                            onSearch();
                        }}
                        aria-label="전체 검색"
                        className="workspace-sidebar-row flex w-full items-center border border-border-primary bg-bg-primary text-text-secondary hover:bg-bg-hover"
                    >
                        <Search size={16} className="shrink-0" />
                        <span className={hideCollapsed}>전체 검색</span>
                        <span
                            className={`ml-auto whitespace-nowrap rounded border border-border-primary px-1 text-[10px] text-text-tertiary ${hideCollapsed}`}
                        >
                            {isDesktopMac ? '⌘ K' : 'Ctrl K'}
                        </span>
                    </button>
                </div>
                <nav
                    aria-label="워크스페이스 영역"
                    className={`flex shrink-0 flex-col gap-0.5 border-b border-border-primary px-3 pb-4 pt-2 ${collapsed ? 'lg:px-2' : ''}`}
                >
                    {sections.map(({ area: target, href, icon: Icon }) => (
                        <AreaLink
                            key={target}
                            href={href}
                            kind={target === 'home' ? undefined : target}
                            label={workspaceAreaLabels[target]}
                            collapsed={collapsed}
                            title={workspaceAreaLabels[target]}
                            aria-label={workspaceAreaLabels[target]}
                            aria-current={area === target ? 'location' : undefined}
                            className={`workspace-sidebar-row flex items-center transition-colors hover:bg-bg-hover ${collapsed ? 'lg:justify-center' : ''} ${area === target ? 'font-medium text-text-primary' : 'text-text-secondary'}`}
                        >
                            <Icon size={16} className="shrink-0" />
                            <span className={hideCollapsed}>{workspaceAreaLabels[target]}</span>
                        </AreaLink>
                    ))}
                </nav>
                <nav
                    aria-label={`${workspaceAreaLabels[area]} 탐색`}
                    className={`min-h-0 flex-1 overflow-y-auto px-3 py-4 ${hideCollapsed}`}
                >
                    {context}
                </nav>
                <div className="mt-auto shrink-0 border-t border-border-primary">
                    {area === 'docs' && canAdmin && (
                        <Link
                            href={`/${teamId}/docs/archived`}
                            aria-label="문서 휴지통"
                            className={
                                'mx-3 mt-2 flex items-center gap-2 rounded-control p-2 text-sm text-text-secondary hover:bg-bg-hover ' +
                                hideCollapsed
                            }
                        >
                            <Trash2 size={16} />
                            휴지통
                        </Link>
                    )}
                    <div className={'flex min-w-0 items-center ' + (collapsed ? 'lg:flex-col' : '')}>
                        <div className="min-w-0 flex-1">
                            <SidebarUserBar
                                username={username}
                                teamId={teamId}
                                collapsed={collapsed}
                                onLogout={onLogout}
                            />
                        </div>
                        <div className="pr-2">
                            <NotificationBell teamId={teamId} compact />
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

function AreaLink({
    kind,
    label,
    collapsed,
    children,
    ...props
}: React.ComponentProps<typeof Link> & { kind?: WorkspaceReference['kind']; label: string; collapsed: boolean }) {
    const reference = { kind: kind ?? 'channel', href: String(props.href), label };
    const drag = useWorkspaceDragSource(reference);
    return (
        <div className="group flex min-w-0 items-center">
            <Link {...props} {...(kind ? drag : {})} className={`${props.className} min-w-0 flex-1`}>
                {children}
            </Link>
            {kind && (
                <span className={collapsed ? 'lg:hidden' : ''}>
                    <WorkspaceOpenButton reference={reference} />
                </span>
            )}
        </div>
    );
}
