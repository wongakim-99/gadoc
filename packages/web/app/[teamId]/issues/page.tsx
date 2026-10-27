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
                    members={board.members}
                    onSubmit={async (data) => {
                        const created = await board.handleCreate({ ...data, sourceMessageId });
                        if (pane) {
                            board.setShowCreate(false);
                            board.setSelectedIssue(created);
                            router.replace(`${pathname}?issue=${created.id}`, { scroll: false });
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
                    onClose={() => {
                        board.setSelectedIssue(null);
                        router.replace(pathname, { scroll: false });
                    }}
                />
            )}
        </>
    );
    if (pane && (board.showCreate || board.selectedIssue)) return <div className="h-full min-h-0">{forms}</div>;

    return (
        <div className="h-full flex flex-col">
            <IssueBoardHeader
                canWrite={board.canWrite}
                onCreate={() => {
                    board.setCreateStatus('todo');
                    board.setShowCreate(true);
                }}
            />
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

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-4 lg:hidden">
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
                <div className="hidden h-full lg:block lg:overflow-x-auto">
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
