'use client';

import { useRef } from 'react';
import { Pencil, X } from 'lucide-react';
import type { Issue } from '@/src/entities/issue/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { MarkdownContent } from '@/src/shared/ui/MarkdownContent';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { WorkspaceReferenceActions } from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import { IssueLinkedResources } from './IssueLinkedResources';
import { PRIORITY_LABELS, STATUS_LABELS } from '../lib/issue.constants';

export function IssueDetails({
    issue,
    members,
    projectName,
    pane,
    readOnly,
    saved,
    onEdit,
    onClose,
}: {
    issue: Issue;
    members: TeamMemberSummary[];
    projectName: string;
    pane: boolean;
    readOnly: boolean;
    saved: boolean;
    onEdit: () => void;
    onClose: () => void;
}) {
    const surface = useRef<HTMLDivElement>(null);
    const title = useRef<HTMLHeadingElement>(null);
    useDialogFocusTrap({ open: !pane, surfaceRef: surface, initialFocusRef: title, onEscape: onClose });
    const names = issue.assigneeIds.map(
        (id) => members.find((member) => member.userId === id)?.user?.username ?? '팀 멤버',
    );
    return (
        <div
            className={
                pane
                    ? 'h-full min-w-0 overflow-y-auto bg-bg-primary'
                    : 'fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3 sm:p-6'
            }
            onClick={() => {
                if (!pane) onClose();
            }}
        >
            <div
                ref={surface}
                role={pane ? 'region' : 'dialog'}
                aria-modal={pane ? undefined : true}
                aria-label="이슈 상세"
                onClick={(event) => event.stopPropagation()}
                className={
                    pane
                        ? 'issue-detail mx-auto w-full max-w-6xl'
                        : 'issue-detail flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-panel border border-border-primary bg-bg-primary shadow-2xl'
                }
            >
                <header className="flex items-start justify-between gap-4 border-b border-border-primary px-5 py-5 sm:px-8">
                    <div className="min-w-0">
                        <p className="mb-2 text-xs text-text-tertiary">{projectName} / 이슈</p>
                        <h2
                            ref={title}
                            tabIndex={-1}
                            className="break-words text-xl font-bold leading-snug text-text-primary outline-none sm:text-2xl"
                        >
                            {issue.title}
                        </h2>
                        {saved && (
                            <p role="status" className="mt-2 text-xs text-text-secondary">
                                변경 사항을 저장했습니다.
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <WorkspaceReferenceActions
                            reference={{
                                kind: 'issues',
                                href: `/${issue.teamId}/issues?issue=${issue.id}`,
                                label: issue.title,
                            }}
                        />
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center gap-1.5 rounded-control border border-border-primary px-3 py-2 text-xs hover:bg-bg-hover"
                            >
                                <Pencil size={14} />
                                편집
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="이슈 상세 닫기"
                            className="rounded-control p-2 text-text-secondary hover:bg-bg-hover"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>
                <div className="issue-detail-grid min-h-0 overflow-y-auto">
                    <section aria-label="이슈 설명" className="min-w-0 px-5 py-6 sm:px-8">
                        {issue.description?.trim() ? (
                            <MarkdownContent>{issue.description}</MarkdownContent>
                        ) : (
                            <p className="text-sm text-text-tertiary">아직 설명이 없습니다.</p>
                        )}
                    </section>
                    <aside
                        aria-label="이슈 속성과 연결 자료"
                        className="min-w-0 border-t border-border-primary bg-bg-secondary/40 px-5 py-6"
                    >
                        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-4 text-sm">
                            <dt className="text-text-tertiary">상태</dt>
                            <dd>{STATUS_LABELS[issue.status]}</dd>
                            <dt className="text-text-tertiary">우선순위</dt>
                            <dd>{PRIORITY_LABELS[issue.priority]}</dd>
                            <dt className="text-text-tertiary">담당자</dt>
                            <dd className="break-words">{names.join(', ') || '미할당'}</dd>
                            <dt className="text-text-tertiary">라벨</dt>
                            <dd className="flex flex-wrap gap-1">
                                {issue.labels.length
                                    ? issue.labels.map((label) => (
                                          <span
                                              key={label}
                                              className="rounded-control border border-border-primary px-1.5 text-xs"
                                          >
                                              {label}
                                          </span>
                                      ))
                                    : '없음'}
                            </dd>
                            <dt className="text-text-tertiary">수정</dt>
                            <dd>
                                <time dateTime={issue.updatedAt}>
                                    {new Date(issue.updatedAt).toLocaleString('ko-KR')}
                                </time>
                            </dd>
                        </dl>
                        <IssueLinkedResources teamId={issue.teamId} issueId={issue.id} readOnly={readOnly} />
                    </aside>
                </div>
            </div>
        </div>
    );
}
