'use client';
import { useParams, useRouter } from 'next/navigation';
import type { Message } from '@/src/entities/message/types';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { useWorkspaceConnection } from '@/src/features/workspace/model/useWorkspaceConnection';
import { RelatedIssues } from './RelatedIssues';

export function MessageWorkPanel({ message }: { message: Message }) {
    const { teamId } = useParams<{ teamId: string }>();
    const workspace = useTeamWorkspaceData(teamId);
    const connection = useWorkspaceConnection();
    const router = useRouter();
    return (
        <div className="mt-2">
            {workspace.canWrite && (
                <button
                    type="button"
                    className="rounded-control border border-border-primary px-3 py-1.5 text-xs text-action-text"
                    onClick={() => {
                        const href = `/${teamId}/issues?create=1&sourceMessage=${encodeURIComponent(message.id)}`;
                        if (connection) connection.open(href, '이 메시지에서 이슈 만들기');
                        else router.push(href);
                    }}
                >
                    이 메시지에서 이슈 만들기
                </button>
            )}
            <p className="mt-2 text-xs text-text-tertiary">
                대화를 보면서 옆에서 작성합니다. 생성하면 이 메시지가 근거로 연결됩니다.
            </p>
            <RelatedIssues teamId={teamId} resourceId={message.id} kind="message" canWrite={workspace.canWrite} />
        </div>
    );
}
