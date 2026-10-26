export type WorkspaceArea = 'home' | 'channel' | 'docs' | 'issues' | 'announcements' | 'settings';

export const workspaceAreaLabels: Record<WorkspaceArea, string> = {
    home: '홈',
    channel: '채팅',
    docs: '문서',
    issues: '이슈',
    announcements: '공지',
    settings: '설정',
};

export function getWorkspaceArea(pathname: string, teamId: string): WorkspaceArea {
    const segment = pathname.slice(`/${teamId}`.length).split('/')[1];
    return ['channel', 'docs', 'issues', 'announcements', 'settings'].includes(segment)
        ? (segment as WorkspaceArea)
        : 'home';
}
