'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceConnection } from '../model/useWorkspaceConnection';
import { usePathname, useRouter } from 'next/navigation';
import { hasTeamAdminAccess } from '@/src/entities/team/lib/access';
import { resolveChannelLabel } from '@/src/entities/channel/lib/resolveChannelLabel';
import type { Channel } from '@/src/entities/channel/types';
import { WorkspaceSearchPalette } from '@/src/features/search/ui/WorkspaceSearchPalette';
import { useDesktopMac } from '../model/useDesktopMac';
import { useWorkspaceSidebarState } from '../model/useWorkspaceSidebarState';
import { useWorkspaceChannels } from '../model/useWorkspaceChannels';
import { DirectRoomLauncher } from './DirectRoomLauncher';
import { SidebarNavLink } from './SidebarNavLink';
import { SidebarSection } from './SidebarSection';
import { CreateChannelButton } from './CreateChannelButton';
import { WorkspaceSidebarShell } from './WorkspaceSidebarShell';
import { DocumentNavigation } from './DocumentNavigation';
import { WorkspaceAreaNavigation } from './WorkspaceAreaNavigation';
import { getWorkspaceArea } from '../model/workspaceNavigation';
import { channelApi, unwrapApiData } from '@/lib/api-client';
import { ProjectSidebar } from '@/src/features/project/ui/ProjectSidebar';
import { TeamSettingsNavigation } from '@/src/features/team/ui/TeamSettingsNavigation';

interface Props {
    teamId: string;
    teamName: string;
    channels: Channel[];
}

export function TeamSidebar({ teamId, teamName, channels }: Props) {
    const routePathname = usePathname();
    const pathname = useWorkspaceConnection()?.activePath ?? routePathname;
    const router = useRouter();
    const isDesktopMac = useDesktopMac();
    const [searchOpen, setSearchOpen] = useState(false);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const {
        canWrite,
        currentMember,
        currentUserId,
        currentUsername,
        logout,
        members,
        teamName: loadedTeamName,
    } = useWorkspaceSidebarState(teamId);
    const activeChannelId = pathname.startsWith(`/${teamId}/channel/`) ? (pathname.split('/')[3] ?? null) : null;
    const { channels: sidebarChannels } = useWorkspaceChannels({
        teamId,
        initialChannels: channels,
        members,
        currentUserId,
        activeChannelId,
    });
    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    const workspaceChannels = sidebarChannels.filter(
        (channel) =>
            !channel.isArchived &&
            (channel.type === 'public' || channel.type === 'private' || channel.type === 'voice'),
    );
    const archivedChannels = sidebarChannels.filter((channel) => channel.isArchived);
    const directChannels = sidebarChannels.filter(
        (channel) => !channel.isArchived && (channel.type === 'dm' || channel.type === 'group'),
    );

    // 채널 생성 인라인 폼 상태
    const [channelFormOpen, setChannelFormOpen] = useState(false);
    const [channelName, setChannelName] = useState('');
    const [channelType, setChannelType] = useState<'public' | 'private' | 'voice'>('public');
    const [channelLoading, setChannelLoading] = useState(false);
    const [channelError, setChannelError] = useState('');
    const channelInputRef = useRef<HTMLInputElement>(null);
    const channelRequest = useRef(0);

    useEffect(() => {
        if (channelFormOpen) {
            setTimeout(() => channelInputRef.current?.focus(), 50);
        } else {
            channelRequest.current++;
            setChannelName('');
            setChannelType('public');
            setChannelError('');
            setChannelLoading(false);
        }
        return () => {
            channelRequest.current++;
        };
    }, [channelFormOpen]);

    const handleCreateChannel = async () => {
        const trimmed = channelName.trim();
        if (!trimmed || channelLoading) return;
        const request = ++channelRequest.current;
        setChannelLoading(true);
        setChannelError('');
        try {
            const created = unwrapApiData<{ id: string }>(
                await channelApi.createChannel(teamId, { name: trimmed, type: channelType }),
            );
            if (created?.id) {
                if (request === channelRequest.current) {
                    setChannelFormOpen(false);
                    router.push(`/${teamId}/channel/${created.id}`);
                }
                router.refresh();
            }
        } catch (error) {
            if (request === channelRequest.current)
                setChannelError(error instanceof Error ? error.message : '채널을 만들지 못했습니다.');
        } finally {
            if (request === channelRequest.current) setChannelLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
            event.preventDefault();
            setSearchOpen(true);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const area = getWorkspaceArea(pathname, teamId);
    const context =
        area === 'settings' ? (
            <TeamSettingsNavigation />
        ) : area === 'docs' ? (
            <DocumentNavigation teamId={teamId} canWrite={canWrite} />
        ) : area === 'channel' ? (
            <>
                {channelFormOpen && channelError && (
                    <p role="alert" className="px-3 py-2 text-xs text-red-300">
                        {channelError}
                    </p>
                )}
                <SidebarSection
                    title="채널"
                    action={
                        canWrite ? (
                            <CreateChannelButton
                                open={channelFormOpen}
                                onToggle={() => setChannelFormOpen((v) => !v)}
                            />
                        ) : undefined
                    }
                >
                    {/* 인라인 채널 생성 폼 — absolute 없이 문서 흐름 안에 렌더링 */}
                    {channelFormOpen && (
                        <div className="mx-3 mb-2 space-y-2 rounded-xl border border-border-primary bg-bg-secondary p-3">
                            <input
                                ref={channelInputRef}
                                value={channelName}
                                disabled={channelLoading}
                                onChange={(e) => {
                                    setChannelName(e.target.value);
                                    setChannelError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleCreateChannel();
                                    if (e.key === 'Escape') setChannelFormOpen(false);
                                }}
                                placeholder="채널 이름"
                                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-white outline-none focus:border-slack-green/50"
                            />
                            <div className="flex items-center gap-1.5">
                                {(['public', 'private', 'voice'] as const).map((t) => (
                                    <button
                                        key={t}
                                        disabled={channelLoading}
                                        onClick={() => {
                                            setChannelType(t);
                                            setChannelError('');
                                        }}
                                        className={`rounded-full px-2 py-0.5 text-[11px] transition ${channelType === t ? 'bg-action text-white' : 'border border-border-primary text-text-tertiary hover:text-white'}`}
                                    >
                                        {t === 'public' ? '공개' : t === 'private' ? '비공개' : '음성'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setChannelFormOpen(false)}
                                    className="flex-1 rounded-lg border border-border-primary px-2 py-1 text-xs text-text-secondary hover:text-white"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => void handleCreateChannel()}
                                    disabled={channelLoading || !channelName.trim()}
                                    className="flex-1 rounded-lg bg-action px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                                >
                                    {channelLoading ? '...' : '만들기'}
                                </button>
                            </div>
                        </div>
                    )}

                    {workspaceChannels.length === 0 && !channelFormOpen && (
                        <p className="px-3 py-2 text-xs text-text-tertiary">아직 채널이 없습니다.</p>
                    )}
                    <div className="space-y-0.5">
                        <ProjectSidebar teamId={teamId} channels={workspaceChannels} pathname={pathname} />
                    </div>
                </SidebarSection>

                {archivedChannels.length > 0 && (
                    <details
                        className="mt-4"
                        open={archivedChannels.some((channel) => channel.id === activeChannelId) || undefined}
                    >
                        <summary className="cursor-pointer rounded-control px-3 py-2 text-xs font-semibold text-text-tertiary hover:bg-bg-hover">
                            보관된 채널 <span className="ml-1">{archivedChannels.length}</span>
                        </summary>
                        <div className="space-y-0.5">
                            {archivedChannels.map((channel) => (
                                <SidebarNavLink
                                    key={channel.id}
                                    href={`/${teamId}/channel/${channel.id}`}
                                    label={`# ${channel.name}`}
                                    active={isActive(`/${teamId}/channel/${channel.id}`)}
                                />
                            ))}
                        </div>
                    </details>
                )}

                {/* DM / 소그룹 섹션 */}
                <div className="mt-4">
                    <SidebarSection title="DM / 소그룹">
                        {canWrite ? (
                            <div className="px-3">
                                <DirectRoomLauncher
                                    teamId={teamId}
                                    members={members.filter((member) => member.userId !== currentUserId)}
                                />
                            </div>
                        ) : (
                            <p className="px-3 py-2 text-xs text-text-tertiary">guest는 읽기 전용입니다.</p>
                        )}
                        <div className="mt-1 space-y-0.5">
                            {directChannels.length === 0 && (
                                <p className="px-3 py-1.5 text-xs text-text-tertiary">직접 대화가 없습니다.</p>
                            )}
                            {directChannels.map((channel) => (
                                <SidebarNavLink
                                    key={channel.id}
                                    href={`/${teamId}/channel/${channel.id}`}
                                    label={resolveChannelLabel(channel, members, currentUserId)}
                                    active={isActive(`/${teamId}/channel/${channel.id}`)}
                                    unreadCount={channel.unreadCount}
                                    mentionCount={channel.mentionCount}
                                />
                            ))}
                        </div>
                    </SidebarSection>
                </div>
            </>
        ) : (
            <WorkspaceAreaNavigation area={area} teamId={teamId} canWrite={canWrite} />
        );
    return (
        <>
            <WorkspaceSidebarShell
                teamId={teamId}
                teamName={loadedTeamName || teamName}
                area={area}
                context={
                    <>
                        {area !== 'channel' && area !== 'settings' && (
                            <div className="mb-4">
                                <ProjectSidebar teamId={teamId} pathname={pathname} />
                            </div>
                        )}
                        {context}
                    </>
                }
                channelId={activeChannelId ?? workspaceChannels[0]?.id}
                canAdmin={hasTeamAdminAccess(currentMember?.role)}
                username={currentUsername}
                onLogout={logout}
                onSearch={() => setSearchOpen(true)}
                searchButtonRef={searchButtonRef}
                isDesktopMac={isDesktopMac}
            />
            <WorkspaceSearchPalette
                onClose={() => setSearchOpen(false)}
                open={searchOpen}
                restoreFocusRef={searchButtonRef}
                workspace={{ canWrite, channels: sidebarChannels, currentUserId, members, teamId }}
            />
        </>
    );
}
