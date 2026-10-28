'use client';
import { useCallback, useState } from 'react';
import { issueApi, unwrapApiArray } from '@/lib/api-client';
import { ISSUE_STATUS_LABELS, type Issue } from '@/src/entities/issue/types';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import { LinkPicker } from './LinkPicker';
import { WorkspaceReferenceDropZone } from '@/src/features/workspace/ui/WorkspaceReferenceDropZone';
import { refreshRelatedWork, useRelatedWork } from '../model/useRelatedWork';

export function RelatedIssues({
    teamId,
    kind,
    resourceId,
    canWrite = false,
}: {
    teamId: string;
    kind: 'document' | 'message';
    resourceId: string;
    canWrite?: boolean;
}) {
    const load = useCallback(async () => {
        const response = await issueApi.getRelated(teamId, kind, resourceId);
        if (!response.success) throw new Error();
        return unwrapApiArray<Issue>(response);
    }, [teamId, kind, resourceId]);
    const state = useRelatedWork(load);
    const [choices, setChoices] = useState<Issue[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [undo, setUndo] = useState<(() => void) | null>(null);
    const [error, setError] = useState('');
    const mutate = async (issueId: string, remove = false) => {
        if (!canWrite || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await (remove ? issueApi.removeLink : issueApi.addLink)(teamId, issueId, kind, resourceId);
            if (!result.success) throw new Error();
            setChoices(null);
            setNotice(remove ? '연결을 해제했습니다. 이슈 원본은 유지됩니다.' : '이슈를 연결했습니다.');
            setUndo(!remove && result.data?.created === true ? () => () => void mutate(issueId, true) : null);
            refreshRelatedWork();
            await state.refresh();
        } catch {
            setError('연결을 저장하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };
    const choose = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await issueApi.getIssues(teamId);
            if (!result.success) throw new Error();
            setChoices(unwrapApiArray<Issue>(result));
        } catch {
            setError('이슈 목록을 불러오지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <section aria-label="연결된 이슈" className="my-4 border-t border-border-primary py-3 text-sm">
            <div className="flex min-h-9 items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-text-secondary">연결된 이슈{state.items.length > 0 && <span className="ml-2 tabular-nums text-text-tertiary">{state.items.length}</span>}</h3>
                {canWrite && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void choose()}
                        className="min-h-9 rounded-control px-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-action active:bg-bg-active disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        이슈 연결
                    </button>
                )}
            </div>
            <WorkspaceReferenceDropZone
                disabled={!canWrite || busy}
                label="이 이슈를 자료에 연결"
                onInsert={(ref) => {
                    const url = new URL(ref.href, window.location.origin);
                    const id = url.searchParams.get('issue');
                    if (ref.kind === 'issues' && id) void mutate(id);
                    else setError('이슈의 연결 아이콘을 끌어다 놓아 주세요.');
                }}
            >
                {state.loading ? (
                    <p role="status">불러오는 중…</p>
                ) : null}
                <ul className="divide-y divide-border-primary">
                    {state.items.map((issue) => (
                        <li
                            key={issue.id}
                            className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 py-2"
                        >
                            <span className="shrink-0 rounded border border-border-primary px-2 py-0.5 text-xs text-text-secondary">
                                {ISSUE_STATUS_LABELS[issue.status]}
                            </span>
                            <ResourceNavigation href={`/${teamId}/issues?issue=${issue.id}`} title={issue.title} />
                            {canWrite && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    aria-label={`${issue.title} 연결 해제`}
                                    onClick={() => void mutate(issue.id, true)}
                                    className="ml-auto min-h-9 rounded-control px-2 text-xs text-text-tertiary hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-action active:bg-bg-active"
                                >
                                    해제
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </WorkspaceReferenceDropZone>
            {choices && (
                <LinkPicker
                    title="이슈 연결"
                    description="현재 자료와 함께 참고할 이슈를 선택하세요. 원본 내용은 변경하지 않습니다."
                    options={choices
                        .filter((issue) => !state.items.some((item) => item.id === issue.id))
                        .map((issue) => ({ ...issue, detail: ISSUE_STATUS_LABELS[issue.status] }))}
                    busy={busy}
                    error={error}
                    onClose={() => setChoices(null)}
                    onConnect={(id) => void mutate(id)}
                />
            )}
            {notice && (
                <div role="status" className="mt-3 text-xs text-text-secondary">
                    {notice}
                    {undo && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={undo}
                            className="ml-2 text-action-text underline"
                        >
                            연결 취소
                        </button>
                    )}
                </div>
            )}
            {(error || state.error) && (
                <p role="alert" className="mt-2 text-xs text-error">
                    {error || state.error}{' '}
                    <button type="button" onClick={() => void state.refresh()}>
                        새로고침
                    </button>
                </p>
            )}
            {state.items.length === 100 && (
                <p className="mt-1 text-xs text-text-tertiary">최근 변경된 이슈 최대 100개를 표시합니다.</p>
            )}
        </section>
    );
}
