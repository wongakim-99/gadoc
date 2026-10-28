'use client';

import { useEffect, useRef, useState } from 'react';
import { documentApi, unwrapApiArray } from '@/lib/api-client';
import type { ProjectFields, WorkspaceProject } from '@/src/entities/project/types';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { projectApi } from '../model/projectApi';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';

export function ProjectManager({
    teamId,
    projects,
    onClose,
}: {
    teamId: string;
    projects: WorkspaceProject[];
    onClose: () => void;
}) {
    const workspace = useTeamWorkspaceData(teamId);
    const [selected, setSelected] = useState('');
    const [fields, setFields] = useState<ProjectFields>({ name: '', channelIds: [], documentId: null });
    const baseline = useRef(JSON.stringify(fields));
    const revision = useRef(0);
    const [docs, setDocs] = useState<Array<{ id: string; title: string }>>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [docsError, setDocsError] = useState('');
    const surface = useRef<HTMLFormElement>(null);
    const mayLeave = () =>
        !busy &&
        (JSON.stringify(fields) === baseline.current ||
            window.confirm('저장하지 않은 업무 설정이 있습니다. 변경을 버릴까요?'));
    const close = () => {
        if (mayLeave()) onClose();
    };
    useWorkspaceLeaveGuard(mayLeave);
    useDialogFocusTrap({ open: true, surfaceRef: surface, onEscape: close });
    useEffect(() => {
        let active = true;
        void documentApi
            .getDocuments(teamId)
            .then((response) => {
                if (active) setDocs(unwrapApiArray(response));
            })
            .catch(() => {
                if (active) setDocsError('문서 목록을 불러오지 못했습니다. 다시 열어 주세요.');
            });
        return () => {
            active = false;
        };
    }, [teamId]);
    const select = (id: string) => {
        if (!mayLeave()) return;
        const project = projects.find((p) => p.id === id);
        const next = project
            ? { name: project.name, channelIds: project.channelIds, documentId: project.documentId }
            : { name: '', channelIds: [], documentId: null };
        setSelected(id);
        setFields(next);
        baseline.current = JSON.stringify(next);
        revision.current = project?.revision ?? 0;
        setError('');
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || !workspace.canManageSettings) return;
        setBusy(true);
        setError('');
        try {
            const response = selected
                ? await projectApi.update(teamId, selected, fields, revision.current)
                : await projectApi.create(teamId, fields);
            if (!response.success || !response.data) throw new Error('업무를 저장하지 못했습니다.');
            window.dispatchEvent(new CustomEvent('gadoc:projects-refresh'));
            onClose();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };
    const input = 'mt-1 w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm';
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={close}>
            <form
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label="업무 관리"
                onSubmit={save}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-panel border border-border-primary bg-bg-secondary p-5 text-text-primary shadow-2xl"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">업무 관리</h3>
                    <button type="button" onClick={close} aria-label="업무 관리 닫기" className="px-2 py-1">
                        닫기
                    </button>
                </div>
                <p className="text-xs leading-5 text-text-tertiary">
                    같은 팀 안에서 채널, 이슈, 문서를 업무별로 묶습니다. 멤버와 기존 자료는 유지됩니다.
                </p>
                {error && (
                    <p role="alert" className="text-sm text-error">
                        {error}
                    </p>
                )}
                <label className="block text-xs">
                    편집할 업무
                    <select
                        aria-label="편집할 업무"
                        disabled={busy}
                        value={selected}
                        onChange={(e) => select(e.target.value)}
                        className={input}
                    >
                        <option value="">새 업무 만들기</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block text-xs">
                    업무 이름
                    <input
                        required
                        maxLength={80}
                        disabled={busy}
                        value={fields.name}
                        onChange={(e) => setFields({ ...fields, name: e.target.value })}
                        className={input}
                    />
                </label>
                <fieldset disabled={busy} className="space-y-2">
                    <legend className="mb-2 text-xs">연결할 채널</legend>
                    {workspace.channels
                        .filter((c) => ['public', 'private', 'voice'].includes(c.type))
                        .map((channel) => {
                            const other = projects.find((p) => p.id !== selected && p.channelIds.includes(channel.id));
                            return (
                                <label
                                    key={channel.id}
                                    className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-bg-hover"
                                >
                                    <input
                                        type="checkbox"
                                        disabled={!!other}
                                        checked={fields.channelIds.includes(channel.id)}
                                        onChange={(e) =>
                                            setFields({
                                                ...fields,
                                                channelIds: e.target.checked
                                                    ? [...fields.channelIds, channel.id]
                                                    : fields.channelIds.filter((id) => id !== channel.id),
                                            })
                                        }
                                    />
                                    <span className="min-w-0 truncate"># {channel.name}</span>
                                    {other && <span className="ml-auto text-xs text-text-tertiary">{other.name}</span>}
                                </label>
                            );
                        })}
                </fieldset>
                <label className="block text-xs">
                    대표 문서
                    <select
                        value={fields.documentId ?? ''}
                        disabled={busy || !!docsError}
                        className={input}
                        onChange={(e) => setFields({ ...fields, documentId: e.target.value || null })}
                    >
                        <option value="">연결하지 않음</option>
                        {docs.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                                {doc.title || '제목 없음'}
                            </option>
                        ))}
                    </select>
                </label>
                {docsError && (
                    <p role="alert" className="text-xs text-error">
                        {docsError}
                    </p>
                )}
                <p className="text-xs text-text-tertiary">
                    채널 소속을 바꿔도 기존 이슈의 업무는 자동으로 옮기지 않습니다. 이슈 수정에서 변경할 수 있습니다.
                </p>
                <button
                    type="submit"
                    disabled={busy || !fields.name.trim() || workspace.loading || !!workspace.error}
                    className="w-full rounded-control bg-action px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                    {busy ? '저장 중' : '업무 저장'}
                </button>
            </form>
        </div>
    );
}
