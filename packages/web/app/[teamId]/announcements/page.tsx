'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { announcementApi, authApi, teamApi } from '@/lib/api-client';
import { hasTeamWriteAccess, resolveCurrentTeamMember } from '@/src/entities/team/lib/access';
import type { Announcement } from '@/src/entities/announcement/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { useSearchParams } from 'next/navigation';
import {
    ConnectedText,
    InsertWorkspaceReference,
    WorkspaceReferenceActions,
} from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';

interface Props {
    params: Promise<{ teamId: string }>;
}

export default function AnnouncementsPage({ params }: Props) {
    const { teamId } = use(params);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [canWrite, setCanWrite] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const searchParams = useSearchParams();
    const focusedId = searchParams.get('announcement');
    useWorkspaceLeaveGuard(
        () =>
            !showCreate ||
            !(title.trim() || content.trim()) ||
            window.confirm('게시하지 않은 공지가 있습니다. 이 화면을 닫을까요?'),
    );
    useEffect(() => {
        if (focusedId) document.getElementById(`announcement-${focusedId}`)?.scrollIntoView({ block: 'center' });
    }, [focusedId, announcements]);

    useEffect(() => {
        let active = true;
        const refresh = () => {
            void announcementApi
                .getAnnouncements(teamId)
                .then((res) => {
                    if (!active) return;
                    if (res.success && Array.isArray(res.data)) setAnnouncements(res.data as Announcement[]);
                    else setError('공지를 불러오지 못했습니다.');
                })
                .catch(() => {
                    if (active) setError('공지를 불러오지 못했습니다.');
                });
        };
        refresh();
        window.addEventListener('slacord:announcements-refresh', refresh);
        return () => {
            active = false;
            window.removeEventListener('slacord:announcements-refresh', refresh);
        };
    }, [teamId]);

    useEffect(() => {
        let active = true;
        Promise.all([authApi.getMe().catch(() => null), teamApi.getMembers(teamId).catch(() => null)]).then(
            ([meRes, memberRes]) => {
                if (!active) return;
                const currentUserId = (meRes?.data as { id?: string } | undefined)?.id ?? '';
                const members =
                    memberRes?.success && Array.isArray(memberRes.data) ? (memberRes.data as TeamMemberSummary[]) : [];
                setCanWrite(hasTeamWriteAccess(resolveCurrentTeamMember(members, currentUserId)?.role));
            },
        );
        return () => {
            active = false;
        };
    }, [teamId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canWrite) return;
        if (!title.trim() || !content.trim()) return;
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            const res = await announcementApi.createAnnouncement(teamId, { title, content });
            if (res.success && res.data) {
                setAnnouncements((prev) => [res.data as Announcement, ...prev]);
                setTitle('');
                setContent('');
                setShowCreate(false);
                window.dispatchEvent(new CustomEvent('slacord:announcements-refresh'));
            } else setError('공지 게시에 실패했습니다. 작성 내용은 유지됩니다.');
        } catch {
            setError('공지 게시에 실패했습니다. 작성 내용은 유지됩니다.');
        } finally {
            setSaving(false);
        }
    };

    const handlePin = async (id: string, isPinned: boolean) => {
        if (!canWrite) return;
        const res = await announcementApi.pinAnnouncement(teamId, id, !isPinned);
        if (res.success && res.data) {
            setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isPinned: !isPinned } : a)));
            window.dispatchEvent(new CustomEvent('slacord:announcements-refresh'));
        }
    };

    return (
        <div className="min-h-full">
            <div className="workspace-topbar">
                <div>
                    <h2 className="text-xl font-bold text-white">공지사항</h2>
                    {!canWrite ? (
                        <p className="mt-1 text-xs text-text-tertiary">guest는 공지를 읽기만 할 수 있습니다.</p>
                    ) : null}
                </div>
                {canWrite ? (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 rounded-control bg-action text-white text-sm font-medium hover:bg-action-hover transition-colors"
                    >
                        공지 작성
                    </button>
                ) : null}
            </div>

            <div className="mx-auto max-w-3xl p-6">
                {error && (
                    <p role="alert" className="mb-3 text-sm text-error">
                        {error}
                    </p>
                )}
                {showCreate && (
                    <form
                        onSubmit={handleCreate}
                        className="bg-bg-secondary rounded-xl border border-border-primary p-5 mb-6"
                    >
                        <InsertWorkspaceReference
                            disabled={!canWrite || saving}
                            onInsert={(_, markdown) =>
                                setContent((value) => [value, markdown].filter(Boolean).join('\n'))
                            }
                        />
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="공지 제목"
                            className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-slack-green/50"
                            required
                        />
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="공지 내용"
                            rows={4}
                            className="w-full bg-bg-primary border border-border-primary rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-slack-green/50 resize-none"
                            required
                        />
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="flex-1 py-2 rounded-lg border border-border-primary text-text-secondary text-sm hover:text-white hover:bg-bg-hover transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-2 rounded-control bg-action text-white text-sm font-medium hover:bg-action-hover disabled:opacity-50 transition-colors"
                            >
                                등록
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {announcements.map((a) => (
                        <div
                            key={a.id}
                            id={`announcement-${a.id}`}
                            className={`bg-bg-secondary rounded-xl border p-5 ${focusedId === a.id ? 'border-action-text ring-1 ring-action-text' : a.isPinned ? 'border-slack-green/40' : 'border-border-primary'}`}
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    {a.isPinned && (
                                        <span className="text-xs bg-slack-green/20 text-slack-green border border-slack-green/30 rounded-full px-2 py-0.5 font-semibold">
                                            고정
                                        </span>
                                    )}
                                    <h3 className="font-semibold text-white">{a.title}</h3>
                                </div>
                                {canWrite ? (
                                    <button
                                        onClick={() => handlePin(a.id, a.isPinned)}
                                        className="text-xs text-text-tertiary hover:text-slack-green transition-colors shrink-0"
                                    >
                                        {a.isPinned ? '고정 해제' : '고정'}
                                    </button>
                                ) : null}
                            </div>
                            <WorkspaceReferenceActions
                                reference={{
                                    kind: 'announcements',
                                    href: `/${teamId}/announcements?announcement=${a.id}`,
                                    label: a.title,
                                }}
                            />
                            <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
                                <ConnectedText text={a.content} />
                            </p>
                            <p className="text-xs text-text-tertiary mt-3">
                                {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                            </p>
                        </div>
                    ))}
                    {announcements.length === 0 && (
                        <p className="text-center text-text-tertiary py-12 text-sm">공지사항이 없습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
