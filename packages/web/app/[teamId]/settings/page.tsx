'use client';

import { use } from 'react';
import { TeamSettingsShell } from '@/src/features/team/ui/TeamSettingsShell';
import { WorkspacePageHeader } from '@/src/features/workspace/ui/WorkspacePageHeader';

interface Props {
    params: Promise<{ teamId: string }>;
}

export default function SettingsPage({ params }: Props) {
    const { teamId } = use(params);

    return (
        <>
            <WorkspacePageHeader title="워크스페이스 설정" />
            <TeamSettingsShell teamId={teamId} />
        </>
    );
}
