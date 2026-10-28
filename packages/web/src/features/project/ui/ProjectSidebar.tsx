'use client';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, BookOpen, ListTodo } from 'lucide-react';
import type { Channel } from '@/src/entities/channel/types';
import { SidebarNavLink } from '@/src/features/workspace/ui/SidebarNavLink';
import { useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { useProjects } from '../model/useProjects';
import { useProjectScope } from '../model/useProjectScope';

export function ProjectSidebar({
    teamId,
    channels,
    pathname,
}: {
    teamId: string;
    channels?: Channel[];
    pathname: string;
}) {
    const { projects, error, loading } = useProjects(teamId);
    const { projectId, selectProject } = useProjectScope(teamId);
    const connection = useWorkspaceConnection();
    const href = connection?.activeHref ?? pathname;
    const navigation = useRef<HTMLAnchorElement>(null);
    const [navigationHref, setNavigationHref] = useState('');
    useEffect(() => {
        if (navigationHref) {
            navigation.current?.click();
            setNavigationHref('');
        }
    }, [navigationHref]);
    const lastNavigation = useRef('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    useEffect(() => {
        if (loading || lastNavigation.current === `${teamId}:${href}`) return;
        lastNavigation.current = `${teamId}:${href}`;
        const url = new URL(href, 'http://workspace.local');
        const explicit = url.searchParams.get('project');
        const current = projects.find(
            (p) =>
                p.id === explicit ||
                p.channelIds.some((id) => url.pathname === `/${teamId}/channel/${id}`) ||
                (p.documentId && url.pathname === `/${teamId}/docs/${p.documentId}`),
        );
        if (current) selectProject(current.id);
        else if (url.pathname === `/${teamId}/issues` || url.pathname.includes(`/${teamId}/channel/`))
            selectProject('');
        // A deliberate "all groups" selection stays until the next navigation.
    }, [href, projects, loading, teamId, selectProject]);
    const channelLink = (channel: Channel) => (
        <SidebarNavLink
            key={channel.id}
            href={`/${teamId}/channel/${channel.id}`}
            label={`# ${channel.name}`}
            active={pathname === `/${teamId}/channel/${channel.id}`}
            unreadCount={channel.unreadCount}
            mentionCount={channel.mentionCount}
        />
    );
    const assigned = new Set(projects.flatMap((p) => p.channelIds));
    const selected = projects.some((p) => p.id === projectId) ? projectId : '';
    return (
        <div className="space-y-1">
            <Link ref={navigation} href={navigationHref || `/${teamId}/issues`} hidden tabIndex={-1} aria-hidden="true">
                이슈
            </Link>
            {error && (
                <p role="alert" className="px-3 text-xs text-error">
                    {error}
                </p>
            )}
            {projects.length > 0 && (
                <label className="mb-3 flex items-center gap-2 px-3 text-xs text-text-secondary">
                    <span className="shrink-0">그룹</span>
                    <select
                        aria-label="탐색 그룹"
                        value={selected}
                        onChange={(event) => {
                            const id = event.target.value;
                            selectProject(id);
                            setCollapsed((current) => ({ ...current, [id]: false }));
                            const target = new URL(href, 'http://workspace.local');
                            if (pathname === `/${teamId}/issues` || target.searchParams.has('project')) {
                                if (id) target.searchParams.set('project', id);
                                else target.searchParams.delete('project');
                                setNavigationHref(target.pathname + target.search);
                            }
                        }}
                        className="min-h-9 min-w-0 flex-1 rounded-control border border-border-primary bg-bg-secondary px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-action"
                    >
                        <option value="">전체 그룹</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {projects
                .filter((p) => !selected || p.id === selected)
                .map((project) => (
                    <section key={project.id} aria-label={`${project.name} 업무`}>
                        <button
                            type="button"
                            aria-expanded={!collapsed[project.id]}
                            aria-controls={`project-nav-${project.id}`}
                            onClick={() =>
                                setCollapsed((current) => ({ ...current, [project.id]: !current[project.id] }))
                            }
                            className="flex min-h-9 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-text-secondary hover:bg-bg-hover active:bg-bg-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                        >
                            {collapsed[project.id] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            <span className="min-w-0 truncate">{project.name}</span>
                        </button>
                        {!collapsed[project.id] && (
                            <div id={`project-nav-${project.id}`} className="ml-5 border-l border-border-primary pl-1">
                                {channels
                                    ?.filter((channel) => project.channelIds.includes(channel.id))
                                    .map(channelLink)}
                                <SidebarNavLink
                                    href={`/${teamId}/issues?project=${project.id}`}
                                    label="이슈 · 일정"
                                    icon={<ListTodo size={16} />}
                                    active={
                                        pathname === `/${teamId}/issues` &&
                                        new URL(href, 'http://workspace.local').searchParams.get('project') ===
                                            project.id
                                    }
                                />
                                {project.documentId && (
                                    <SidebarNavLink
                                        href={`/${teamId}/docs/${project.documentId}`}
                                        label="문서"
                                        icon={<BookOpen size={16} />}
                                        active={pathname === `/${teamId}/docs/${project.documentId}`}
                                    />
                                )}
                            </div>
                        )}
                    </section>
                ))}
            {!selected && channels?.filter((channel) => !assigned.has(channel.id)).map(channelLink)}
        </div>
    );
}
