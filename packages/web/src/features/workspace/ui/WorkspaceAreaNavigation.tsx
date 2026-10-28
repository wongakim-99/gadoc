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
    return (
        <div className="space-y-3 px-1">
            <h2 className="text-xs font-semibold text-text-secondary">{workspaceAreaLabels[area]}</h2>
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
                    대시보드
                </Link>
            )}
        </div>
    );
}
