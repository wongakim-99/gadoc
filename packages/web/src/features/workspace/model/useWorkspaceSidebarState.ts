'use client';

import { authApi } from '@/lib/api-client';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';

export function useWorkspaceSidebarState(teamId: string) {
    const workspace = useTeamWorkspaceData(teamId);

    const logout = async () => {
        await authApi.logout();
        // Reset authenticated sockets and cached workspace data between accounts.
        window.location.assign('/auth/login');
    };

    return {
        teamName: workspace.team?.name,
        currentMember: workspace.currentMember,
        currentUserId: workspace.currentUserId,
        currentUsername: workspace.currentUsername,
        canWrite: workspace.canWrite,
        logout,
        members: workspace.members,
    };
}
