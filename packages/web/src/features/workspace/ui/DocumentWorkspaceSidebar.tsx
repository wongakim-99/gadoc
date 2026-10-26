'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    BookOpen,
    Home,
    MessageSquare,
    ListTodo,
    Megaphone,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Plus,
    Settings,
    Trash2,
} from 'lucide-react';
import { documentApi, unwrapApiArray } from '@/lib/api-client';
import type { DocumentFull, DocumentNode } from '@/src/entities/document/types';
import { DocumentTree } from '@/src/widgets/document/ui/DocumentTree';
import { NotificationBell } from '@/src/features/notification/ui/NotificationBell';
import { SidebarUserBar } from './SidebarUserBar';

export function DocumentWorkspaceSidebar({
    teamId,
    teamName,
    channelId,
    canWrite,
    canAdmin,
    username,
    onLogout,
    onSearch,
}: {
    teamId: string;
    teamName: string;
    channelId?: string;
    canWrite: boolean;
    canAdmin: boolean;
    username: string;
    onLogout: () => Promise<void>;
    onSearch: () => void;
}) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [documents, setDocuments] = useState<DocumentNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const mobile = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        if (mobile.current) mobile.current.open = false;
        let active = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await documentApi.getDocuments(teamId);
                if (!response.success) throw new Error('페이지 목록을 불러오지 못했습니다.');
                if (active) setDocuments(unwrapApiArray<DocumentNode>(response));
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : '페이지 목록 오류');
            } finally {
                if (active) setLoading(false);
            }
        };
        const update = (event: Event) => {
            const doc = (event as CustomEvent<DocumentFull>).detail;
            if (doc.teamId === teamId)
                setDocuments((current) =>
                    current.map((item) =>
                        item.id === doc.id ? { ...item, title: doc.title, updatedAt: doc.updatedAt } : item,
                    ),
                );
        };
        void load();
        window.addEventListener('slacord:document-updated', update);
        window.addEventListener('slacord:documents-refresh', load);
        return () => {
            active = false;
            window.removeEventListener('slacord:document-updated', update);
            window.removeEventListener('slacord:documents-refresh', load);
        };
    }, [teamId, pathname]);

    const sections = [
        { label: '홈', href: `/${teamId}`, icon: Home },
        { label: '채팅', href: channelId ? `/${teamId}/channel/${channelId}` : `/${teamId}`, icon: MessageSquare },
        { label: '문서', href: `/${teamId}/docs`, icon: BookOpen },
        { label: '이슈', href: `/${teamId}/issues`, icon: ListTodo },
        { label: '공지', href: `/${teamId}/announcements`, icon: Megaphone },
    ];
    const moduleLinks = (compact = false) => (
        <nav
            aria-label="워크스페이스 영역"
            className={compact ? 'flex flex-col gap-1 p-2' : 'grid grid-cols-3 gap-1 px-3 py-3'}
        >
            {sections.map(({ label, href, icon: Icon }) => (
                <Link
                    key={label}
                    href={href}
                    title={label}
                    aria-label={label}
                    aria-current={label === '문서' ? 'location' : undefined}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs transition hover:bg-white/10 ${label === '문서' ? 'bg-white/10 text-white' : 'text-neutral-400'}`}
                >
                    <Icon size={16} />
                    {!compact && <span>{label}</span>}
                </Link>
            ))}
        </nav>
    );
    const tree = (
        <>
            <div className="mb-3 flex items-center justify-between px-1">
                <Link className="text-xs font-medium text-neutral-400 hover:text-white" href={`/${teamId}/docs`}>
                    페이지
                </Link>
                {canWrite && (
                    <Link
                        href={`/${teamId}/docs?create=1`}
                        aria-label="페이지 추가"
                        className="rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                    >
                        <Plus size={16} />
                    </Link>
                )}
            </div>
            {loading && (
                <p role="status" className="text-xs text-neutral-400">
                    페이지를 불러오는 중…
                </p>
            )}
            {error && (
                <p role="alert" className="text-xs text-red-300">
                    {error}
                </p>
            )}
            {!loading && !error && <DocumentTree documents={documents} teamId={teamId} />}
        </>
    );
    const utilities = (
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2 text-xs text-neutral-400">
            {canAdmin && (
                <Link
                    className="flex items-center gap-1 rounded p-2 hover:bg-white/10"
                    href={`/${teamId}/docs/archived`}
                >
                    <Trash2 size={14} />
                    휴지통
                </Link>
            )}
            <Link className="flex items-center gap-1 rounded p-2 hover:bg-white/10" href={`/${teamId}/settings`}>
                <Settings size={14} />
                설정
            </Link>
        </div>
    );
    return (
        <>
            <aside
                aria-label="문서 사이드바"
                className={`document-workspace hidden h-screen shrink-0 flex-col border-r border-white/10 bg-[#202020] lg:sticky lg:top-0 lg:flex ${collapsed ? 'w-16' : 'w-64'}`}
            >
                <div className="flex min-h-14 items-center justify-between gap-2 border-b border-white/10 px-3">
                    {!collapsed && (
                        <Link href={`/${teamId}`} className="truncate text-sm font-semibold">
                            {teamName}
                        </Link>
                    )}
                    <button
                        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        aria-expanded={!collapsed}
                        onClick={() => setCollapsed(!collapsed)}
                        className="rounded p-2 text-neutral-400 hover:bg-white/10"
                    >
                        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </button>
                </div>
                {moduleLinks(collapsed)}
                {collapsed ? (
                    <button
                        onClick={onSearch}
                        aria-label="워크스페이스 검색"
                        className="mx-auto rounded p-2 text-neutral-400 hover:bg-white/10"
                    >
                        <Search size={16} />
                    </button>
                ) : (
                    <>
                        <div className="mx-3 mb-2 border-b border-white/10 pb-2">
                            <button
                                onClick={onSearch}
                                className="mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-neutral-400 hover:bg-white/10"
                            >
                                <Search size={16} />
                                전체 검색<span className="ml-auto text-[10px]">Ctrl/⌘ K</span>
                            </button>
                            <NotificationBell teamId={teamId} />
                        </div>
                        <nav aria-label="문서 탐색" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                            {tree}
                        </nav>
                        {utilities}
                        <SidebarUserBar username={username} onLogout={onLogout} />
                    </>
                )}
            </aside>
            <details ref={mobile} className="document-workspace border-b border-white/10 bg-[#202020] lg:hidden">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                    {teamName} <span className="ml-2 text-neutral-400">문서 · 페이지 탐색</span>
                </summary>
                {moduleLinks()}
                <div className="flex items-center gap-2 px-4 pb-3">
                    <button
                        onClick={() => {
                            if (mobile.current) mobile.current.open = false;
                            onSearch();
                        }}
                        className="flex items-center gap-2 rounded px-2 py-2 text-sm text-neutral-400 hover:bg-white/10"
                    >
                        <Search size={16} />
                        전체 검색
                    </button>
                    <NotificationBell teamId={teamId} />
                </div>
                <div className="max-h-[50vh] overflow-auto px-4 pb-4">{tree}</div>
                {utilities}
                <SidebarUserBar username={username} onLogout={onLogout} />
            </details>
        </>
    );
}
