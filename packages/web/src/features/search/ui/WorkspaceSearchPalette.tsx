'use client';

import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { startTransition, useEffect, useId, useMemo, useRef, useState } from 'react';
import { channelApi, documentApi, issueApi, unwrapApiArray, unwrapApiData } from '@/lib/api-client';
import { resolveChannelLabel } from '@/src/entities/channel/lib/resolveChannelLabel';
import type { Channel } from '@/src/entities/channel/types';
import type { DocumentNode } from '@/src/entities/document/types';
import type { Issue } from '@/src/entities/issue/types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { useDashboardMessages } from '@/src/features/dashboard/model/useDashboardMessages';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';

interface WorkspacePaletteContext {
    canWrite: boolean;
    channels: Channel[];
    currentUserId: string;
    members: TeamMemberSummary[];
    teamId: string;
}

interface Props {
    onClose: () => void;
    open: boolean;
    restoreFocusRef?: React.RefObject<HTMLElement | null>;
    workspace?: WorkspacePaletteContext;
}

interface PaletteAction {
    description: string;
    id: string;
    label: string;
    run: () => void | Promise<void>;
}

export function WorkspaceSearchPalette({ onClose, open, restoreFocusRef, workspace }: Props) {
    const reduceMotion = useReducedMotion();
    const router = useRouter();
    const search = useDashboardMessages();
    const surfaceRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [documents, setDocuments] = useState<DocumentNode[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [resourceError, setResourceError] = useState('');
    const [resourceLoading, setResourceLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const [busyActionId, setBusyActionId] = useState<string | null>(null);

    useDialogFocusTrap({
        initialFocusRef: inputRef,
        onEscape: onClose,
        open,
        restoreFocusRef,
        surfaceRef,
    });

    useEffect(() => {
        if (!open || !workspace?.teamId) return;

        let active = true;
        setResourceLoading(true);
        setResourceError('');

        Promise.all([documentApi.getDocuments(workspace.teamId), issueApi.getIssues(workspace.teamId)])
            .then(([documentsResponse, issuesResponse]) => {
                if (!active) return;
                setDocuments(unwrapApiArray<DocumentNode>(documentsResponse));
                setIssues(unwrapApiArray<Issue>(issuesResponse));
            })
            .catch((error: Error) => {
                if (!active) return;
                setResourceError(error.message || '빠른 이동에 필요한 워크스페이스 데이터를 불러오지 못했습니다.');
            })
            .finally(() => {
                if (active) setResourceLoading(false);
            });

        return () => {
            active = false;
        };
    }, [open, workspace?.teamId]);

    const trimmedQuery = search.query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const recentDocuments = useMemo(
        () => [...documents].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
        [documents],
    );
    const recentIssues = useMemo(
        () => [...issues].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
        [issues],
    );
    const channelTargets = useMemo(() => {
        if (!workspace) return [];
        const source = workspace.channels.map((channel) => ({
            channel,
            href: `/${workspace.teamId}/channel/${channel.id}`,
            label:
                channel.type === 'dm' || channel.type === 'group'
                    ? resolveChannelLabel(channel, workspace.members, workspace.currentUserId)
                    : `# ${channel.name}`,
            searchText:
                channel.type === 'dm' || channel.type === 'group'
                    ? resolveChannelLabel(channel, workspace.members, workspace.currentUserId)
                    : channel.name,
        }));
        return filterCollection(source, normalizedQuery, 6);
    }, [normalizedQuery, workspace]);
    const documentTargets = useMemo(
        () =>
            filterCollection(
                recentDocuments.map((document) => ({
                    document,
                    href: `/${document.teamId}/docs/${document.id}`,
                    label: document.title,
                    searchText: document.title,
                })),
                normalizedQuery,
                6,
            ),
        [normalizedQuery, recentDocuments],
    );
    const issueTargets = useMemo(
        () =>
            filterCollection(
                recentIssues.map((issue) => ({
                    issue,
                    href: `/${issue.teamId}/issues?issue=${issue.id}`,
                    label: issue.title,
                    searchText: issue.title,
                })),
                normalizedQuery,
                6,
            ),
        [normalizedQuery, recentIssues],
    );
    const quickActions = useMemo(() => {
        const actions: PaletteAction[] = [
            {
                id: 'dashboard-messages',
                label: '전체 메시지 검색 열기',
                description: '워크스페이스 메시지 검색 대시보드로 이동합니다.',
                run: () => navigateWithClose(router, onClose, '/dashboard/messages'),
            },
        ];

        if (!workspace) {
            actions.unshift(
                {
                    id: 'dashboard-home',
                    label: '대시보드 열기',
                    description: '워크스페이스 목록과 최근 활동을 확인합니다.',
                    run: () => navigateWithClose(router, onClose, '/dashboard'),
                },
                {
                    id: 'dashboard-new-team',
                    label: '새 팀 만들기',
                    description: '새 워크스페이스 생성 화면으로 이동합니다.',
                    run: () => navigateWithClose(router, onClose, '/dashboard/teams/new'),
                },
            );
            return filterCollection(actions, normalizedQuery, 8, ['label', 'description']);
        }

        actions.unshift(
            {
                id: 'workspace-issues',
                label: '이슈 보드 열기',
                description: '현재 워크스페이스의 이슈 보드로 이동합니다.',
                run: () => navigateWithClose(router, onClose, `/${workspace.teamId}/issues`),
            },
            {
                id: 'workspace-docs',
                label: '문서/위키 열기',
                description: '문서 트리와 최신 문서를 확인합니다.',
                run: () => navigateWithClose(router, onClose, `/${workspace.teamId}/docs`),
            },
            {
                id: 'workspace-announcements',
                label: '공지사항 열기',
                description: '공지 목록과 핀된 운영 소식을 확인합니다.',
                run: () => navigateWithClose(router, onClose, `/${workspace.teamId}/announcements`),
            },
            {
                id: 'workspace-settings',
                label: '워크스페이스 설정 열기',
                description: '연동, 초대, 운영 이력 설정 화면으로 이동합니다.',
                run: () => navigateWithClose(router, onClose, `/${workspace.teamId}/settings`),
            },
        );

        if (workspace.canWrite && trimmedQuery.length >= 2) {
            actions.unshift(
                {
                    id: 'create-channel',
                    label: `# ${trimmedQuery} 채널 생성`,
                    description: '새 공개 채널을 만들고 바로 대화 화면으로 이동합니다.',
                    run: async () => {
                        setActionError('');
                        setBusyActionId('create-channel');
                        try {
                            const created = unwrapApiData<{ id: string }>(
                                await channelApi.createChannel(workspace.teamId, {
                                    name: trimmedQuery,
                                    type: 'public',
                                }),
                            );
                            if (created?.id) {
                                startTransition(() => {
                                    onClose();
                                    router.push(`/${workspace.teamId}/channel/${created.id}`);
                                    router.refresh();
                                });
                            }
                        } catch (error) {
                            setActionError(error instanceof Error ? error.message : '채널을 생성하지 못했습니다.');
                        } finally {
                            setBusyActionId(null);
                        }
                    },
                },
                {
                    id: 'create-document',
                    label: `"${trimmedQuery}" 문서 생성`,
                    description: '새 문서를 만들고 블록 에디터를 바로 엽니다.',
                    run: async () => {
                        setActionError('');
                        setBusyActionId('create-document');
                        try {
                            const created = unwrapApiData<{ id: string }>(
                                await documentApi.createDocument(workspace.teamId, {
                                    title: trimmedQuery,
                                    content: '',
                                    contentFormat: 'json',
                                }),
                            );
                            if (created?.id) {
                                startTransition(() => {
                                    onClose();
                                    router.push(`/${workspace.teamId}/docs/${created.id}?edit=1`);
                                    router.refresh();
                                });
                            }
                        } catch (error) {
                            setActionError(error instanceof Error ? error.message : '문서를 생성하지 못했습니다.');
                        } finally {
                            setBusyActionId(null);
                        }
                    },
                },
                {
                    id: 'create-issue',
                    label: `"${trimmedQuery}" 이슈 초안 열기`,
                    description: '제목이 채워진 생성 모달로 이동해 세부 정보를 입력합니다.',
                    run: () => {
                        const params = new URLSearchParams();
                        params.set('create', '1');
                        params.set('status', 'todo');
                        params.set('title', trimmedQuery);
                        navigateWithClose(router, onClose, `/${workspace.teamId}/issues?${params.toString()}`);
                    },
                },
            );
        }

        return filterCollection(actions, normalizedQuery, 8, ['label', 'description']);
    }, [normalizedQuery, onClose, router, trimmedQuery, workspace]);

    const entries = useMemo(() => {
        const resources = [
            ...channelTargets.map((target) => ({
                id: target.href,
                label: target.label,
                detail: '채널',
                run: () => navigateWithClose(router, onClose, target.href),
            })),
            ...documentTargets.map((target) => ({
                id: target.href,
                label: target.label,
                detail: '문서',
                run: () => navigateWithClose(router, onClose, target.href),
            })),
            ...issueTargets.map((target) => ({
                id: target.href,
                label: target.label,
                detail: '이슈',
                run: () => navigateWithClose(router, onClose, target.href),
            })),
        ];
        const messages = (trimmedQuery ? search.results : search.recentResults).slice(0, 6).map((message) => ({
            id: `message:${message.id}`,
            label: message.content || '첨부 파일',
            detail: `${message.authorName} · #${message.channelName}`,
            run: () =>
                navigateWithClose(
                    router,
                    onClose,
                    `/${message.teamId}/channel/${message.channelId}?message=${message.id}&at=${encodeURIComponent(message.createdAt)}`,
                ),
        }));
        return [
            ...resources.map((entry) => ({ ...entry, group: '바로 이동' })),
            ...messages.map((entry) => ({ ...entry, group: trimmedQuery ? '메시지' : '최근 메시지' })),
            ...quickActions.map((action) => ({
                ...action,
                detail: action.id.startsWith('create-') ? '새로 만들기' : '열기',
                group: '빠른 실행',
            })),
        ];
    }, [
        channelTargets,
        documentTargets,
        issueTargets,
        onClose,
        quickActions,
        router,
        search.recentResults,
        search.results,
        trimmedQuery,
    ]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [search.query, open]);
    useEffect(() => {
        resultsRef.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);
    const activeIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const runEntry = (index: number) => {
        if (!busyActionId) void entries[index]?.run();
    };

    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                ref={surfaceRef}
                initial={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="workspace-command-dialog flex max-h-[75vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-secondary shadow-2xl outline-none"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id={titleId} className="sr-only">
                    워크스페이스 검색
                </h2>
                <div className="flex items-center gap-3 border-b border-border-primary px-4 py-4">
                    <svg
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-text-tertiary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeWidth={2} strokeLinecap="round" d="m21 21-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0" />
                    </svg>
                    <input
                        ref={inputRef}
                        autoFocus
                        role="combobox"
                        aria-label="워크스페이스 검색"
                        aria-autocomplete="list"
                        aria-expanded="true"
                        aria-controls={`${titleId}-results`}
                        aria-activedescendant={entries.length ? `${titleId}-result-${activeIndex}` : undefined}
                        placeholder="채널, 메시지, 문서, 이슈 검색"
                        value={search.query}
                        onChange={(event) => search.setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing) return;
                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault();
                                if (entries.length)
                                    setSelectedIndex(
                                        (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) %
                                            entries.length,
                                    );
                            } else if (event.key === 'Enter') {
                                event.preventDefault();
                                runEntry(activeIndex);
                            }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-text-tertiary"
                    />
                    <button
                        type="button"
                        aria-label="검색 닫기"
                        onClick={onClose}
                        className="rounded border border-border-primary px-2 py-1 text-xs text-text-tertiary hover:text-white"
                    >
                        Esc
                    </button>
                </div>
                {(search.error || resourceError || actionError) && (
                    <p role="alert" className="px-4 py-2 text-sm text-red-300">
                        {actionError || search.error || resourceError}
                    </p>
                )}
                {(search.booting || search.indexing || resourceLoading) && (
                    <p role="status" className="px-4 py-2 text-xs text-text-tertiary">
                        검색 중…
                    </p>
                )}
                <div
                    ref={resultsRef}
                    id={`${titleId}-results`}
                    role="listbox"
                    aria-label="검색 결과"
                    className="min-h-0 overflow-y-auto p-2"
                >
                    {entries.map((entry, index) => (
                        <div key={entry.id} role="presentation">
                            {(index === 0 || entries[index - 1].group !== entry.group) && (
                                <p
                                    role="presentation"
                                    className="px-3 pb-1 pt-3 text-[11px] font-semibold text-text-tertiary"
                                >
                                    {entry.group}
                                </p>
                            )}
                            <button
                                id={`${titleId}-result-${index}`}
                                data-index={index}
                                type="button"
                                role="option"
                                aria-selected={activeIndex === index}
                                disabled={Boolean(busyActionId)}
                                tabIndex={-1}
                                onMouseMove={() => setSelectedIndex(index)}
                                onClick={() => runEntry(index)}
                                className={`relative isolate flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm disabled:opacity-50 ${activeIndex === index ? 'text-white' : 'text-text-secondary'}`}
                            >
                                {activeIndex === index && (
                                    <motion.span
                                        aria-hidden="true"
                                        layoutId={`${titleId}-highlight`}
                                        className="absolute inset-0 -z-10 rounded-md bg-brand-500/15"
                                        transition={{ duration: reduceMotion ? 0 : 0.12 }}
                                    />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {busyActionId === entry.id ? '처리 중…' : entry.label}
                                </span>
                                <span className="max-w-[40%] truncate text-xs text-text-tertiary">{entry.detail}</span>
                            </button>
                        </div>
                    ))}
                    {!entries.length && !search.indexing && (
                        <p className="px-3 py-10 text-center text-sm text-text-tertiary">검색 결과가 없습니다.</p>
                    )}
                </div>
                <div className="flex items-center justify-between border-t border-border-primary px-4 py-2.5 text-[11px] text-text-tertiary">
                    <span>↑↓ 이동 · Enter 열기 · Esc 닫기</span>
                    <button
                        type="button"
                        onClick={() => navigateWithClose(router, onClose, '/dashboard/messages')}
                        className="hover:text-white"
                    >
                        전체 메시지 검색 ↗
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function filterCollection<T>(
    items: T[],
    normalizedQuery: string,
    limit: number,
    searchKeys: string[] = ['searchText'],
) {
    const filtered = normalizedQuery
        ? items.filter((item) =>
              searchKeys.some((key) =>
                  String((item as Record<string, unknown>)[key] ?? '')
                      .toLowerCase()
                      .includes(normalizedQuery),
              ),
          )
        : items;
    return filtered.slice(0, limit);
}

function navigateWithClose(router: ReturnType<typeof useRouter>, onClose: () => void, href: string) {
    startTransition(() => {
        onClose();
        router.push(href);
    });
}
