'use client';

import type { IssueStatus } from '@/src/entities/issue/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { CircleDot, RotateCcw, Search, UsersRound } from 'lucide-react';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import { IssueFilterSelect } from './IssueFilterSelect';

interface Props {
    query: string;
    assigneeId: string;
    status: IssueStatus | 'all';
    members: TeamMemberSummary[];
    onQueryChange: (value: string) => void;
    onAssigneeChange: (value: string) => void;
    onStatusChange: (value: IssueStatus | 'all') => void;
    onReset: () => void;
}

export function IssueBoardFilters(props: Props) {
    const filtered = Boolean(props.query || props.assigneeId || props.status !== 'all');
    return (
        <div className="issue-board-filters flex flex-col gap-3 border-b border-border-primary px-4 py-3">
            <div className="relative min-w-0 flex-1">
                <Search
                    aria-hidden="true"
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                    aria-label="이슈 검색"
                    value={props.query}
                    onChange={(event) => props.onQueryChange(event.target.value)}
                    placeholder="이슈 제목이나 설명을 검색해 보세요"
                    className="min-h-10 w-full rounded-control border border-border-primary bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-action/50"
                />
            </div>
            <div className="issue-board-filter-controls flex flex-wrap gap-2">
                <IssueFilterSelect
                    label="담당자 필터"
                    value={props.assigneeId}
                    active={Boolean(props.assigneeId)}
                    icon={<UsersRound size={15} />}
                    onChange={props.onAssigneeChange}
                    options={[
                        { value: '', label: '모든 담당자' },
                        { value: 'unassigned', label: '미할당' },
                        ...props.members.map((member) => {
                            const name = member.user?.username ?? '팀 멤버';
                            return {
                                value: member.userId,
                                label: name,
                                marker: (
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: getAvatarColor(member.userId) }}
                                    >
                                        {name.slice(0, 1)}
                                    </span>
                                ),
                            };
                        }),
                    ]}
                />
                <IssueFilterSelect
                    label="상태 필터"
                    value={props.status}
                    active={props.status !== 'all'}
                    icon={<CircleDot size={15} />}
                    onChange={(value) => props.onStatusChange(value as IssueStatus | 'all')}
                    options={[
                        { value: 'all', label: '모든 상태' },
                        { value: 'todo', label: '할 일' },
                        { value: 'in_progress', label: '진행 중' },
                        { value: 'in_review', label: '리뷰 중' },
                        { value: 'done', label: '완료' },
                    ]}
                />
                <button
                    type="button"
                    aria-label="초기화"
                    title="필터 초기화"
                    onClick={props.onReset}
                    disabled={!filtered}
                    className="flex min-h-10 items-center gap-1.5 rounded-control px-2.5 py-2 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-action/40"
                >
                    <RotateCcw aria-hidden="true" size={13} />
                    <span className="issue-filter-reset-label">초기화</span>
                </button>
            </div>
        </div>
    );
}
