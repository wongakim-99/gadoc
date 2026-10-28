'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { documentApi, issueApi, unwrapApiArray } from '@/lib/api-client';
import type { DocumentNode } from '@/src/entities/document/types';
import { ISSUE_STATUS_LABELS, type Issue, type IssueStatus } from '@/src/entities/issue/types';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { useProjects } from '@/src/features/project/model/useProjects';
import { useProjectScope } from '@/src/features/project/model/useProjectScope';
import { subscribeDatabaseChanges } from '@/src/features/database/model/databaseSocket';
import { WorkspaceQuickStart } from './WorkspaceQuickStart';

const statuses: IssueStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
export function WorkspaceOverview({ teamId }: { teamId: string }) {
    const workspace = useTeamWorkspaceData(teamId);
    const projects = useProjects(teamId);
    const { projectId, selectProject } = useProjectScope(teamId);
    const [period, setPeriod] = useState('');
    const [mine, setMine] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [snapshot, setSnapshot] = useState<{ teamId: string; issues: Issue[]; documents: DocumentNode[]; at: number }>();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        let version = 0;
        let timer: ReturnType<typeof setTimeout>;
        const load = async () => {
            const request = ++version;
            setLoading(true);
            try {
                const [issues, documents] = await Promise.all([issueApi.getIssues(teamId), documentApi.getDocuments(teamId)]);
                if (!issues.success || !documents.success) throw new Error('업무 현황을 불러오지 못했습니다.');
                if (active && request === version) {
                    setSnapshot({ teamId, issues: unwrapApiArray<Issue>(issues), documents: unwrapApiArray<DocumentNode>(documents), at: Date.now() });
                    setError('');
                }
            } catch (caught) {
                if (active && request === version) setError(caught instanceof Error ? caught.message : '업무 현황을 불러오지 못했습니다.');
            } finally { if (active && request === version) setLoading(false); }
        };
        const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 250); };
        void load();
        window.addEventListener('focus', schedule);
        const unsubscribe = subscribeDatabaseChanges(teamId, (event) => {
            if (['issue', 'document', 'project'].includes(event.resourceKind ?? '')) schedule();
        });
        return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', schedule); unsubscribe(); };
    }, [teamId, refresh]);
    const data = snapshot?.teamId === teamId ? snapshot : undefined;
    const project = projects.projects.find((item) => item.id === projectId);
    const invalidScope = !!projectId && !project && !projects.loading;
    const cutoff = period && data ? data.at - Number(period) * 86400000 : 0;
    const since = cutoff ? new Date(cutoff).toISOString() : '';
    const scopedIssues = (data?.issues ?? []).filter((issue) => (!projectId || issue.projectId === projectId) && (!cutoff || Date.parse(issue.updatedAt) >= cutoff));
    const issues = scopedIssues.filter((issue) => !mine || issue.assigneeIds.includes(workspace.currentUserId));
    const myIssues = scopedIssues.filter((issue) => issue.assigneeIds.includes(workspace.currentUserId) && issue.status !== 'done')
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const rootIds = new Set(project?.documentId ? [project.documentId] : []);
    if (projectId) {
        const children = new Map<string, string[]>();
        for (const doc of data?.documents ?? []) if (doc.parentId) children.set(doc.parentId, [...(children.get(doc.parentId) ?? []), doc.id]);
        const queue = [...rootIds];
        for (let index = 0; index < queue.length; index++) for (const id of children.get(queue[index]) ?? []) {
            if (!rootIds.has(id)) { rootIds.add(id); queue.push(id); }
        }
    }
    const documents = (data?.documents ?? []).filter((doc) => !doc.archivedAt && !doc.isDatabasePage && (!projectId || rootIds.has(doc.id)) && (!cutoff || Date.parse(doc.updatedAt) >= cutoff))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const channels = workspace.channels.filter((channel) => !channel.isArchived && ['public', 'private', 'voice'].includes(channel.type) && (!projectId || project?.channelIds.includes(channel.id)));
    const recentChannels = channels.filter((channel) => channel.lastMessageAt && (!cutoff || Date.parse(channel.lastMessageAt) >= cutoff))
        .sort((a, b) => Date.parse(b.lastMessageAt!) - Date.parse(a.lastMessageAt!));
    const assigneeIds = new Set(scopedIssues.flatMap((issue) => issue.assigneeIds));
    const members = projectId ? workspace.members.filter((member) => assigneeIds.has(member.userId)) : workspace.members;
    const issueHref = (status?: IssueStatus, assignee?: string, issue?: string) => {
        const params = new URLSearchParams();
        if (projectId) params.set('project', projectId);
        if (status) params.set('filterStatus', status);
        if (assignee || mine) params.set('filterAssignee', assignee || workspace.currentUserId);
        if (since) params.set('updatedAfter', since);
        if (issue) params.set('issue', issue);
        return `/${teamId}/issues${params.size ? '?' + params : ''}`;
    };
    const failed = error || workspace.error || projects.error;
    const ready = data && workspace.hasBaseSnapshot && !projects.loading && !invalidScope && !failed;
    const panel = 'min-w-0 rounded-panel border border-border-primary bg-bg-secondary p-4';
    const row = 'flex min-w-0 items-center justify-between gap-3 rounded-control px-2 py-2 text-sm hover:bg-bg-hover';
    return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6" aria-label="업무 현황">
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0"><h1 className="truncate text-xl font-semibold text-text-primary">{project?.name ?? workspace.team?.name ?? '워크스페이스'}</h1>
                <p className="mt-1 text-xs text-text-tertiary">{data ? `${new Date(data.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준` : '불러오는 중'}</p></div>
            <div className="flex flex-wrap items-center gap-2">
                <select aria-label="현황 업무 그룹" value={projectId} onChange={(event) => selectProject(event.target.value)} className="max-w-48 rounded-control border border-border-primary bg-bg-secondary px-2 py-2 text-sm">
                    <option value="">전체 그룹</option>{projects.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select aria-label="현황 기간" value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-control border border-border-primary bg-bg-secondary px-2 py-2 text-sm">
                    <option value="">전체 기간</option><option value="7">최근 7일 변경</option><option value="30">최근 30일 변경</option>
                </select>
                <button type="button" aria-label="현황 새로고침" disabled={loading} onClick={() => { setRefresh((value) => value + 1); void workspace.refreshBase(); }} className="rounded-control p-2 text-text-secondary hover:bg-bg-hover disabled:opacity-40"><RefreshCw size={16} /></button>
            </div>
        </div>
        {failed && <div role="alert" className="rounded-control border border-border-primary p-3 text-sm text-error">{failed}</div>}
        {invalidScope && <div className="text-sm">선택한 업무를 찾을 수 없습니다. <button className="underline" onClick={() => selectProject('')}>전체 그룹 보기</button></div>}
        {!ready && !failed && !invalidScope && <p role="status" className="text-sm text-text-secondary">업무 현황을 불러오는 중…</p>}
        {ready && <>
            <section aria-label="이슈 진행 현황" className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">이슈 진행 현황</h2><label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />내 담당만</label></div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{statuses.map((status) => <Link key={status} href={issueHref(status)} className={`${panel} hover:bg-bg-hover`} aria-label={`${ISSUE_STATUS_LABELS[status]} 이슈 ${issues.filter((issue) => issue.status === status).length}개`}>
                    <span className="text-xs text-text-secondary">{ISSUE_STATUS_LABELS[status]}</span><strong className="mt-2 block text-2xl font-semibold tabular-nums">{issues.filter((issue) => issue.status === status).length}</strong>
                </Link>)}</div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
                <section className={panel}><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">내 담당 작업</h2><Link href={issueHref(undefined, workspace.currentUserId)} className="text-xs text-text-secondary">전체 보기</Link></div>
                    {myIssues.length ? myIssues.slice(0, 8).map((issue) => <Link key={issue.id} href={issueHref(undefined, undefined, issue.id)} className={row}><span className="min-w-0 truncate">{issue.title}</span><span className="shrink-0 text-xs text-text-tertiary">{ISSUE_STATUS_LABELS[issue.status]}</span></Link>) : <p className="py-3 text-sm text-text-tertiary">담당 중인 작업이 없습니다.</p>}
                </section>
                <section className={panel}><h2 className="mb-3 text-sm font-semibold">최근 문서</h2>
                    {documents.length ? documents.slice(0, 8).map((doc) => <Link key={doc.id} href={`/${teamId}/docs/${doc.id}`} className={row}><span className="min-w-0 truncate">{doc.title || '제목 없음'}</span><time className="shrink-0 text-xs text-text-tertiary" dateTime={doc.updatedAt}>{new Date(doc.updatedAt).toLocaleDateString('ko-KR')}</time></Link>) : <p className="py-3 text-sm text-text-tertiary">표시할 문서가 없습니다.</p>}
                </section>
                <section className={panel}><h2 className="mb-3 text-sm font-semibold">최근 대화</h2>
                    {recentChannels.length ? recentChannels.slice(0, 8).map((channel) => <Link key={channel.id} href={`/${teamId}/channel/${channel.id}`} className={row}><span className="min-w-0 truncate"># {channel.name}</span><time className="shrink-0 text-xs text-text-tertiary" dateTime={channel.lastMessageAt!}>{new Date(channel.lastMessageAt!).toLocaleDateString('ko-KR')}</time></Link>) : <p className="py-3 text-sm text-text-tertiary">최근 대화가 없습니다.</p>}
                    {!recentChannels.length && channels.slice(0, 8).map((channel) => <Link key={channel.id} href={`/${teamId}/channel/${channel.id}`} className={row}><span className="min-w-0 truncate"># {channel.name}</span><span className="shrink-0 text-xs text-text-tertiary">채널 열기</span></Link>)}
                    {!channels.length && !projectId && workspace.canWrite && <WorkspaceQuickStart teamId={teamId} />}
                </section>
                <section className={panel}><h2 className="mb-3 text-sm font-semibold">{projectId ? '작업 담당자' : '워크스페이스 멤버'} <span className="text-text-tertiary">{members.length}</span></h2>
                    <div className="flex flex-wrap gap-2">{members.map((member) => <Link key={member.userId} href={issueHref(undefined, member.userId)} className="rounded-control bg-bg-hover px-2 py-1 text-xs">{member.user?.username ?? '팀 멤버'}</Link>)}</div>
                    {!members.length && <p className="py-3 text-sm text-text-tertiary">담당자가 지정되지 않았습니다.</p>}
                </section>
            </div>
        </>}
    </div>;
}
