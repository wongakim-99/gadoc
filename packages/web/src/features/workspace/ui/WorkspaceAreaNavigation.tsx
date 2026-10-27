import Link from 'next/link';
import { workspaceAreaLabels, type WorkspaceArea } from '../model/workspaceNavigation';

export function WorkspaceAreaNavigation({
    area,
    teamId,
    canWrite,
}: {
    area: WorkspaceArea;
    teamId: string;
    canWrite: boolean;
}) {
    const descriptions: Partial<Record<WorkspaceArea, string>> = {
        home: '대화에서 지식을 정리하고, 이슈로 실행하고, 공지로 공유하세요.',
        issues: '팀의 할 일과 진행 상태를 관리합니다. 보드와 필터는 본문에서 선택하세요.',
        announcements: '팀 전체가 알아야 할 소식과 결정 사항을 공유합니다.',
        settings: '워크스페이스 정보와 멤버, 권한을 관리합니다.',
    };
    return (
        <div className="space-y-3 px-1">
            <h2 className="text-xs font-semibold text-text-secondary">{workspaceAreaLabels[area]}</h2>
            <p className="text-xs leading-6 text-text-tertiary">{descriptions[area]}</p>
            {area === 'issues' && canWrite && (
                <Link
                    href={`/${teamId}/issues?create=1`}
                    className="block rounded-md border border-border-primary px-3 py-2 text-sm hover:bg-bg-hover"
                >
                    + 이슈 만들기
                </Link>
            )}
            {area === 'home' && (
                <Link
                    href="/dashboard"
                    className="block rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-hover"
                >
                    워크스페이스 전환
                </Link>
            )}
        </div>
    );
}
