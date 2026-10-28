'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { IssueFilterSelect } from '@/src/features/issue/ui/IssueFilterSelect';
import { useProjects } from '../model/useProjects';
import { ProjectManager } from './ProjectManager';
import { Folder } from 'lucide-react';

export function ProjectScopeBar({ teamId }: { teamId: string }) {
    const { projects, error, loading } = useProjects(teamId);
    const workspace = useTeamWorkspaceData(teamId);
    const [managing, setManaging] = useState(false);
    const router = useRouter(),
        pathname = usePathname(),
        params = useSearchParams();
    const selected = params.get('project') ?? '';
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-primary px-4 py-2.5">
            <span className="mr-1 text-xs text-text-tertiary">업무</span>
            <IssueFilterSelect
                label="업무 범위"
                value={selected}
                active={!!selected}
                icon={<Folder size={14} />}
                onChange={(value) => {
                    const next = new URLSearchParams(params.toString());
                    if (value) next.set('project', value);
                    else next.delete('project');
                    next.delete('issue');
                    router.replace(`${pathname}?${next}`, { scroll: false });
                }}
                options={[
                    { value: '', label: '전체 업무' },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                    { value: 'unassigned', label: '미분류' },
                ]}
            />
            {workspace.canManageSettings && (
                <button
                    type="button"
                    disabled={loading || !!error}
                    onClick={() => setManaging(true)}
                    className="ml-auto rounded-control px-2 py-1.5 text-xs text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                >
                    업무 관리
                </button>
            )}
            {error && (
                <p role="alert" className="w-full text-xs text-error">
                    {error}
                </p>
            )}
            {managing && <ProjectManager teamId={teamId} projects={projects} onClose={() => setManaging(false)} />}
        </div>
    );
}
