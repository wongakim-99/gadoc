'use client';
import { useCallback, useState } from 'react';
import { documentApi, issueApi, unwrapApiArray } from '@/lib/api-client';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import { LinkPicker } from './LinkPicker';
import { WorkspaceReferenceDropZone } from '@/src/features/workspace/ui/WorkspaceReferenceDropZone';
import { refreshRelatedWork, useRelatedWork } from '../model/useRelatedWork';

interface Resource {
    kind: 'document' | 'message';
    resourceId: string;
    relation: 'origin' | 'reference';
    title: string;
    href: string;
    location?: string;
}
export function IssueLinkedResources({
    teamId,
    issueId,
    readOnly,
}: {
    teamId: string;
    issueId: string;
    readOnly: boolean;
}) {
    const load = useCallback(async () => {
        const result = await issueApi.getLinks(teamId, issueId);
        if (!result.success) throw new Error();
        return unwrapApiArray<Resource>(result);
    }, [teamId, issueId]);
    const state = useRelatedWork(load);
    const [options, setOptions] = useState<Array<{ id: string; title: string }> | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [undo, setUndo] = useState<(() => void) | null>(null);
    const change = async (kind: Resource['kind'], resourceId: string, remove = false) => {
        if (readOnly || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await (remove ? issueApi.removeLink : issueApi.addLink)(teamId, issueId, kind, resourceId);
            if (!result.success) throw new Error();
            setOptions(null);
            setNotice(remove ? '연결을 해제했습니다. 자료 원본은 유지됩니다.' : '자료를 연결했습니다.');
            setUndo(!remove && result.data?.created === true ? () => () => void change(kind, resourceId, true) : null);
            refreshRelatedWork();
            await state.refresh();
        } catch {
            setError('연결을 저장하지 못했습니다. 접근 권한을 확인하고 다시 시도해 주세요.');
        } finally {
            setBusy(false);
        }
    };
    const choose = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await documentApi.getDocuments(teamId);
            if (!result.success) throw new Error();
            setOptions(unwrapApiArray(result));
        } catch {
            setError('문서 목록을 불러오지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <section aria-label="연결된 자료" className="my-4 rounded-control border border-border-primary p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium">연결된 자료</h4>
                {!readOnly && (
                    <button
                        type="button"
                        disabled={busy}
                        className="text-xs text-action-text"
                        onClick={() => void choose()}
                    >
                        자료 연결
                    </button>
                )}
            </div>
            <WorkspaceReferenceDropZone
                disabled={readOnly || busy}
                label="이슈에 참고 자료 연결"
                onInsert={(ref) => {
                    const url = new URL(ref.href, window.location.origin);
                    const id =
                        ref.kind === 'docs'
                            ? url.pathname.split('/')[3]
                            : ref.kind === 'channel'
                              ? url.searchParams.get('message')
                              : null;
                    if (id) void change(ref.kind === 'docs' ? 'document' : 'message', id);
                    else setError('문서 또는 메시지의 연결 아이콘을 놓아 주세요.');
                }}
            >
                {state.loading ? (
                    <p role="status">불러오는 중…</p>
                ) : state.items.length === 0 && !state.error ? (
                    <p className="text-xs text-text-tertiary">볼 수 있는 연결 자료가 없습니다.</p>
                ) : null}
                <ul className="space-y-2">
                    {state.items.map((item) => (
                        <li
                            key={`${item.kind}:${item.resourceId}`}
                            className="flex flex-wrap items-center gap-2 rounded-control bg-bg-primary p-2"
                        >
                            <span className="shrink-0 text-xs text-text-tertiary">
                                {item.relation === 'origin' ? '생성 근거' : item.kind === 'document' ? '문서' : '대화'}
                            </span>
                            <div className="min-w-0 flex-1">
                                {item.location && (
                                    <p className="mb-1 break-words text-[11px] leading-5 text-text-tertiary">
                                        {item.location}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <ResourceNavigation href={item.href} title={item.title} />
                                </div>
                            </div>
                            {!readOnly && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    className="text-xs text-text-tertiary"
                                    aria-label={`${item.title} 연결 해제`}
                                    onClick={() => void change(item.kind, item.resourceId, true)}
                                >
                                    해제
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </WorkspaceReferenceDropZone>
            {!readOnly && (
                <p className="mt-2 text-[11px] text-text-tertiary">
                    연결·해제는 즉시 저장됩니다. 문서나 메시지를 끌어와도 연결할 수 있습니다.
                </p>
            )}
            {options && (
                <LinkPicker
                    title="자료 연결"
                    description="이슈에 참고할 문서를 선택하세요. 대화는 메시지의 ‘이슈 연결’에서 추가하거나 끌어다 놓으세요."
                    options={options.filter(
                        (doc) => !state.items.some((item) => item.kind === 'document' && item.resourceId === doc.id),
                    )}
                    busy={busy}
                    error={error}
                    onClose={() => setOptions(null)}
                    onConnect={(id) => void change('document', id)}
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
        </section>
    );
}
