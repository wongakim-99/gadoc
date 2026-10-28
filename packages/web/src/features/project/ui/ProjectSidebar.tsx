'use client';

import Link from 'next/link';
import type { Channel } from '@/src/entities/channel/types';
import { SidebarNavLink } from '@/src/features/workspace/ui/SidebarNavLink';
import { useProjects } from '../model/useProjects';

export function ProjectSidebar({
    teamId,
    channels,
    pathname,
}: {
    teamId: string;
    channels?: Channel[];
    pathname: string;
}) {
    const { projects, error } = useProjects(teamId);
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
    const assigned = new Set(projects.flatMap((project) => project.channelIds));
    return (
        <div className="space-y-3">
            {error && (
                <p role="alert" className="px-3 text-xs text-error">
                    {error}
                </p>
            )}
            {projects.map((project) => (
                <section key={project.id} aria-label={`${project.name} 업무`}>
                    <div className="mx-3 mb-1 flex items-center justify-between gap-2 border-b border-border-primary/60 pb-1">
                        <Link
                            href={`/${teamId}/issues?project=${project.id}`}
                            className="truncate text-xs font-semibold text-text-secondary hover:text-text-primary"
                        >
                            {project.name}
                        </Link>
                        <div className="flex shrink-0 gap-2 text-[11px] text-text-tertiary">
                            <Link href={`/${teamId}/issues?project=${project.id}`} className="hover:text-text-primary">
                                이슈·일정
                            </Link>
                            {project.documentId && (
                                <Link
                                    href={`/${teamId}/docs/${project.documentId}`}
                                    className="hover:text-text-primary"
                                >
                                    문서
                                </Link>
                            )}
                        </div>
                    </div>
                    {channels?.filter((channel) => project.channelIds.includes(channel.id)).map(channelLink)}
                </section>
            ))}
            {channels?.filter((channel) => !assigned.has(channel.id)).map(channelLink)}
        </div>
    );
}
