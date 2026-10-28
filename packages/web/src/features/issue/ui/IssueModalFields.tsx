import type { IssuePriority, IssueStatus } from '@/src/entities/issue/types';
import { useRef } from 'react';
import { WorkspaceReferenceDropZone } from '@/src/features/workspace/ui/WorkspaceReferenceDropZone';
import { insertReferenceAtSelection } from '@/src/features/workspace/model/workspaceDrag';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../lib/issue.constants';

interface Props {
    description: string;
    hideDescription?: boolean;
    isEdit: boolean;
    priority: IssuePriority;
    readOnly?: boolean;
    setDescription: (value: string) => void;
    setPriority: (value: IssuePriority) => void;
    setStatus: (value: IssueStatus) => void;
    setTitle: (value: string) => void;
    status: IssueStatus;
    title: string;
}

export function IssueModalFields(props: Props) {
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    return (
        <>
            <label htmlFor="issue-title" className="mb-1 block text-xs text-text-tertiary">
                제목 *
            </label>
            <input
                id="issue-title"
                aria-label="이슈 제목"
                value={props.title}
                disabled={props.readOnly}
                onChange={(event) => props.setTitle(event.target.value)}
                className="mb-3 w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-action-text/60 disabled:opacity-60"
                placeholder="이슈 제목"
                required
            />

            {!props.hideDescription && (
                <>
                    <label htmlFor="issue-description" className="mb-1 block text-xs text-text-tertiary">
                        설명 · Markdown
                    </label>
                    <WorkspaceReferenceDropZone
                        disabled={props.readOnly}
                        label="이슈 설명에 참조 추가 · 저장은 직접 확인"
                        onInsert={(_, markdown) =>
                            props.setDescription(
                                insertReferenceAtSelection(props.description, markdown, descriptionRef.current),
                            )
                        }
                    >
                        <textarea
                            id="issue-description"
                            ref={descriptionRef}
                            value={props.description}
                            disabled={props.readOnly}
                            onChange={(event) => props.setDescription(event.target.value)}
                            className="mb-3 min-h-64 w-full resize-y rounded-control border border-border-primary bg-bg-primary px-3 py-3 font-mono text-sm leading-6 text-text-primary focus:outline-none focus:border-action-text/60 disabled:opacity-60"
                            rows={12}
                            placeholder="이슈 설명을 입력해 주세요"
                        />
                    </WorkspaceReferenceDropZone>
                </>
            )}

            <div className="mb-3 flex gap-3">
                <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-tertiary">우선순위</label>
                    <select
                        value={props.priority}
                        disabled={props.readOnly}
                        onChange={(event) => props.setPriority(event.target.value as IssuePriority)}
                        className="w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-action-text/60 disabled:opacity-60"
                    >
                        {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                                {PRIORITY_LABELS[priority]}
                            </option>
                        ))}
                    </select>
                </div>
                {props.isEdit ? (
                    <div className="flex-1">
                        <label className="mb-1 block text-xs text-text-tertiary">상태</label>
                        <select
                            value={props.status}
                            disabled={props.readOnly}
                            onChange={(event) => props.setStatus(event.target.value as IssueStatus)}
                            className="w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-action-text/60 disabled:opacity-60"
                        >
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
            </div>
        </>
    );
}
