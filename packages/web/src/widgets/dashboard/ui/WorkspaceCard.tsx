import Link from 'next/link';
import type { TeamSummary } from '@/src/entities/team/types';

interface Props {
    team: TeamSummary;
}

export function WorkspaceCard({ team }: Props) {
    return (
        <div className="min-w-0 rounded-panel border border-border-primary bg-bg-secondary p-6 transition hover:border-border-glow hover:bg-bg-hover">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs uppercase tracking-[0.18em] text-action-text">{team.slug}</p>
                    <Link
                        href={`/${team.id}`}
                        className="mt-2 block break-words text-xl font-bold text-white hover:text-action-text"
                    >
                        {team.name}
                    </Link>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-selection px-3 py-1 text-xs font-medium text-action-text">
                    {team.memberCount}명
                </span>
            </div>
            <p className="mt-4 min-h-12 break-words text-sm leading-6 text-text-secondary">
                {team.description || '워크스페이스 설명이 아직 없습니다.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
                <span>{team.githubConfig?.repoUrl ? 'GitHub 연결됨' : 'GitHub 미연결'}</span>
                <span>{new Date(team.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
                <Link
                    href={`/${team.id}`}
                    className="rounded-control bg-action px-3 py-2 text-xs font-semibold text-white"
                >
                    열기
                </Link>
                <Link
                    href={`/${team.id}/docs`}
                    className="rounded-lg border border-border-primary px-3 py-2 text-xs font-medium text-white"
                >
                    문서
                </Link>
                <Link
                    href={`/${team.id}/issues`}
                    className="rounded-lg border border-border-primary px-3 py-2 text-xs font-medium text-white"
                >
                    이슈
                </Link>
            </div>
        </div>
    );
}
