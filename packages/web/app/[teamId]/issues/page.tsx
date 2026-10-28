'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DropResult } from '@hello-pangea/dnd';
import { IssueModal } from '@/src/features/issue/ui/IssueModal';
import { IssueBoardFilters } from '@/src/features/issue/ui/IssueBoardFilters';
import { IssueDesktopBoard } from '@/src/features/issue/ui/IssueDesktopBoard';
import { IssueBoardHeader } from '@/src/features/issue/ui/IssueBoardHeader';
import { IssueMobileSection } from '@/src/features/issue/ui/IssueMobileSection';
import type { IssueStatus } from '@/src/entities/issue/types';
import { useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { useIssueBoard } from '@/src/features/issue/model/useIssueBoard';
import { ProjectScopeBar } from '@/src/features/project/ui/ProjectScopeBar';

const COLUMNS: IssueStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

interface Props {
    params: Promise<{ teamId: string }>;
}

export default function IssuesPage({ params }: Props) {
    const { teamId } = use(params);
    const pathname = usePathname();
    const board = useIssueBoard(teamId);
    const router = useRouter();
    const searchParams = useSearchParams();
    const connection = useWorkspaceConnection();
    const sourceMessageId = searchParams.get('sourceMessage') ?? undefined;
    const pane = !!connection?.embedded || !!sourceMessageId;
    const quickCreateTitle = searchParams.get('title') ?? '';
    const quickCreateStatus = normalizeIssueStatus(searchParams.get('status'));
    const shouldOpenQuickCreate = searchParams.get('create') === '1';

    const clearQuickCreateParams = () => {
        if (!shouldOpenQuickCreate) return;
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete('create');
        nextParams.delete('sourceMessage');
        nextParams.delete('status');
        nextParams.delete('title');
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    };

    useEffect(() => {
        if (!shouldOpenQuickCreate) return;
        board.setCreateStatus(quickCreateStatus ?? 'todo');
        board.setShowCreate(true);
    }, [board.setCreateStatus, board.setShowCreate, quickCreateStatus, shouldOpenQuickCreate]);

    const handleDragEnd = async (result: DropResult) => {
        const { draggableId, destination, source } = result;
        if (!board.canWrite || !destination || destination.droppableId === source.droppableId) return;
        await board.handleMove(draggableId, destination.droppableId as IssueStatus);
    };

    const forms = (
        <>
            {board.showCreate && (
                <IssueModal
                    presentation={pane ? 'pane' : 'modal'}
                    sourceNotice={
                        sourceMessageId
                            ? '이 메시지를 생성 근거로 연결합니다. 제목과 설명은 팀에 공유되므로 공유할 내용만 작성하세요.'
                            : undefined
                    }
                    initialTitle={quickCreateTitle}
                    key={`create:${quickCreateTitle}:${board.createStatus}`}
                    mode="create"
                    readOnly={!board.canWrite}
                    teamId={teamId}
                    initialProjectId={board.projectId && board.projectId !== 'unassigned' ? board.projectId : undefined}
                    members={board.members}
                    onSubmit={async (data) => {
                        const created = await board.handleCreate({ ...data, sourceMessageId });
                        if (pane) {
                            board.setShowCreate(false);
                            board.setSelectedIssue(created);
                            const next = new URLSearchParams();
                            next.set('issue', created.id);
                            if (created.projectId) next.set('project', created.projectId);
                            router.replace(`${pathname}?${next}`, { scroll: false });
                        }
                    }}
                    onClose={() => {
                        board.setShowCreate(false);
                        clearQuickCreateParams();
                    }}
                />
            )}
            {board.selectedIssue && (
                <IssueModal
                    key={board.selectedIssue.id}
                    presentation={pane ? 'pane' : 'modal'}
                    mode="edit"
                    issue={board.selectedIssue}
                    readOnly={!board.canWrite}
                    members={board.members}
                    onSubmit={board.handleUpdate}
                    onDelete={board.handleDelete}
                    onClose={() => {
                        board.setSelectedIssue(null);
                        const next = new URLSearchParams(searchParams.toString());
                        next.delete('issue');
                        router.replace(`${pathname}?${next}`, { scroll: false });
                    }}
                />
            )}
        </>
    );
    if (pane && (board.showCreate || board.selectedIssue)) return <div className="h-full min-h-0">{forms}</div>;

    return (
        <div className="issue-workspace h-full min-h-0 min-w-0 flex flex-col">
            <IssueBoardHeader
                teamId={teamId}
                projectId={board.projectId}
                canWrite={board.canWrite}
                onCreate={() => {
                    board.setCreateStatus('todo');
                    board.setShowCreate(true);
                }}
            />
            <ProjectScopeBar teamId={teamId} />
            <IssueBoardFilters
                query={board.query}
                assigneeId={board.assigneeId}
                status={board.statusFilter}
                members={board.members}
                onQueryChange={board.setQuery}
                onAssigneeChange={board.setAssigneeId}
                onStatusChange={board.setStatusFilter}
                onReset={() => {
                    board.setQuery('');
                    board.setAssigneeId('');
                    board.setStatusFilter('all');
                }}
            />

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
                <div className="issue-board-stacked space-y-4">
                    {COLUMNS.map((status) => (
                        <IssueMobileSection
                            canWrite={board.canWrite}
                            key={status}
                            issues={board.issuesByStatus[status]}
                            members={board.members}
                            onAddClick={() => {
                                board.setCreateStatus(status);
                                board.setShowCreate(true);
                            }}
                            onCardClick={board.setSelectedIssue}
                            status={status}
                        />
                    ))}
                </div>
                <div className="issue-board-columns h-full overflow-x-auto">
                    <IssueDesktopBoard
                        canWrite={board.canWrite}
                        columns={COLUMNS}
                        issuesByStatus={board.issuesByStatus}
                        members={board.members}
                        onAddClick={(status) => {
                            board.setCreateStatus(status);
                            board.setShowCreate(true);
                        }}
                        onCardClick={board.setSelectedIssue}
                        onDragEnd={handleDragEnd}
                    />
                </div>
            </div>

            {forms}
        </div>
    );
}

function normalizeIssueStatus(value: string | null): IssueStatus | null {
    if (!value) return null;
    return ['todo', 'in_progress', 'in_review', 'done'].includes(value) ? (value as IssueStatus) : null;
}
