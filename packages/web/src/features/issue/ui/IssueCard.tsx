import { Draggable } from '@hello-pangea/dnd';
import type { Issue, IssuePriority } from '@/src/entities/issue/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { getAvatarColor } from '@/src/shared/lib/avatar';
import { WorkspaceReferenceActions } from '@/src/features/workspace/ui/WorkspaceReferenceActions';

const PRIORITY_COLORS: Record<IssuePriority, string> = {
    low: 'text-text-tertiary border-text-tertiary/30',
    medium: 'text-blue-400 border-blue-400/30',
    high: 'text-yellow-400 border-yellow-400/30',
    urgent: 'text-red-400 border-red-400/30',
};

const PRIORITY_LABELS: Record<IssuePriority, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
    urgent: '긴급',
};

interface Props {
    draggable?: boolean;
    issue: Issue;
    index: number;
    members: TeamMemberSummary[];
    onClick: (issue: Issue) => void;
}
export function IssueCard({ draggable = true, issue, index, members, onClick }: Props) {
    const priorityClass = PRIORITY_COLORS[issue.priority];
    const assignees = members.filter((m) => issue.assigneeIds.includes(m.userId));
    const reference = {
        kind: 'issues' as const,
        href: `/${issue.teamId}/issues?issue=${issue.id}`,
        label: issue.title,
    };

    if (!draggable) {
        return (
            <div className="group rounded-lg border border-border-primary bg-bg-secondary p-3 transition-colors hover:bg-bg-hover">
                <button type="button" onClick={() => onClick(issue)} className="w-full text-left">
                    <IssueCardBody assignees={assignees} issue={issue} priorityClass={priorityClass} />
                </button>
                <div className="mt-2 flex justify-end">
                    <WorkspaceReferenceActions reference={reference} />
                </div>
            </div>
        );
    }

    return (
        <Draggable draggableId={issue.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`w-full text-left bg-bg-secondary hover:bg-bg-hover border border-border-primary rounded-lg p-3 transition-colors cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'shadow-xl rotate-[2deg] border-action-text' : ''}`}
                >
                    <div {...provided.dragHandleProps} onClick={() => onClick(issue)}>
                        <IssueCardBody assignees={assignees} issue={issue} priorityClass={priorityClass} />
                    </div>
                    <div className="mt-2 flex justify-end">
                        <WorkspaceReferenceActions reference={reference} />
                    </div>
                </div>
            )}
        </Draggable>
    );
}

function IssueCardBody({
    assignees,
    issue,
    priorityClass,
}: {
    assignees: TeamMemberSummary[];
    issue: Issue;
    priorityClass: string;
}) {
    return (
        <>
            <p className="mb-2 line-clamp-2 break-words text-sm font-medium text-white">{issue.title}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${priorityClass}`}>
                        {PRIORITY_LABELS[issue.priority]}
                    </span>
                    {issue.labels.slice(0, 2).map((label) => (
                        <span
                            key={label}
                            className="max-w-full break-words rounded-full border border-slack-green/20 bg-slack-green/10 px-2 py-0.5 text-xs text-slack-green"
                        >
                            {label}
                        </span>
                    ))}
                    {issue.labels.length > 2 && (
                        <span className="rounded-full border border-border-primary px-2 py-0.5 text-xs text-text-tertiary">
                            +{issue.labels.length - 2}
                        </span>
                    )}
                </div>
                {issue.assigneeIds.length === 0 && <span className="shrink-0 text-xs text-text-tertiary">미할당</span>}
                {assignees.length > 0 ? (
                    <div className="flex shrink-0 -space-x-1.5">
                        {assignees.slice(0, 3).map((member) => {
                            const name = member.user?.username ?? member.userId.slice(-4);
                            return (
                                <div
                                    key={member.userId}
                                    title={name}
                                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg-secondary text-[9px] font-bold text-white"
                                    style={{ backgroundColor: getAvatarColor(member.userId) }}
                                >
                                    {name.slice(0, 1).toUpperCase()}
                                </div>
                            );
                        })}
                        {assignees.length > 3 ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg-secondary bg-bg-tertiary text-[9px] font-bold text-text-tertiary">
                                +{assignees.length - 3}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </>
    );
}
