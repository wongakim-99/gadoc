'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, Columns2, Link2, X } from 'lucide-react';
import { WorkspaceConnection, canLeaveWorkspacePane } from '../model/useWorkspaceConnection';
import { sameDocument, workspaceHref, type WorkspaceReference } from '../model/workspaceReference';
import { hasReferenceDrag, readReferenceDrag, validDragReference } from '../model/workspaceDrag';

const protocol = 'slacord-workspace-v1';
const resourceEvents = [
    'slacord:document-updated',
    'slacord:documents-refresh',
    'slacord:issues-refresh',
    'slacord:announcements-refresh',
];

export function ConnectedWorkspace({
    teamId,
    sidebar,
    children,
}: {
    teamId: string;
    sidebar: ReactNode;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [embedded, setEmbedded] = useState(false);
    const [secondary, setSecondary] = useState<{ href: string; label: string } | null>(null);
    const [secondaryPath, setSecondaryPath] = useState('');
    const [pending, setPending] = useState<WorkspaceReference | null>(null);
    const [dragging, setDragging] = useState<WorkspaceReference | null>(null);
    const [edgeOver, setEdgeOver] = useState<'left' | 'right' | null>(null);
    const [splitDragging, setSplitDragging] = useState(false);
    const [ratio, setRatio] = useState(50);
    const [reversed, setReversed] = useState(false);
    const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary');
    const [mobilePane, setMobilePane] = useState<'primary' | 'secondary'>('primary');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const frame = useRef<HTMLIFrameElement>(null);
    const panes = useRef<HTMLDivElement>(null);
    const latest = useRef({ pending, secondary });
    latest.current = { pending, secondary };
    const leaveRequests = useRef(new Map<string, (allowed: boolean) => void>());
    const frameReady = useRef(false);
    const transition = useRef(false);
    const relaying = useRef(false);
    const post = useCallback(
        (target: Window | null, type: string, data: unknown = null) => {
            target?.postMessage({ protocol, teamId, type, data }, window.location.origin);
        },
        [teamId],
    );

    useEffect(() => {
        setEmbedded(window.parent !== window && window.name === `slacord-pane-${teamId}`);
    }, [teamId]);
    const offer = useCallback(
        (reference: WorkspaceReference | null) => {
            if (embedded) post(window.parent, 'offer', reference);
            else {
                setPending(reference);
                post(frame.current?.contentWindow ?? null, 'pending', reference);
            }
        },
        [embedded, post],
    );
    const drag = useCallback(
        (reference: WorkspaceReference | null) => {
            setDragging(reference);
            if (!reference) setEdgeOver(null);
            post(embedded ? window.parent : (frame.current?.contentWindow ?? null), 'drag', reference);
        },
        [embedded, post],
    );
    useEffect(() => {
        const clear = () => {
            drag(null);
            setSplitDragging(false);
        };
        const start = (event: DragEvent) =>
            setSplitDragging(event.target instanceof Element && !!event.target.closest('aside'));
        window.addEventListener('dragstart', start, true);
        // Keep the target mounted until its React drop handler consumes the payload.
        const afterDrop = () => window.setTimeout(clear, 0);
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') clear();
        };
        window.addEventListener('dragend', clear);
        window.addEventListener('drop', afterDrop, true);
        window.addEventListener('keydown', escape);
        return () => {
            window.removeEventListener('dragstart', start, true);
            window.removeEventListener('dragend', clear);
            window.removeEventListener('drop', afterDrop, true);
            window.removeEventListener('keydown', escape);
        };
    }, [drag]);
    const mayClose = useCallback(
        () =>
            new Promise<boolean>((resolve) => {
                if (!frame.current || !latest.current.secondary) return resolve(true);
                if (!frameReady.current) {
                    setNotice('옆 화면을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
                    return resolve(false);
                }
                const id = crypto.randomUUID();
                const timeout = window.setTimeout(() => {
                    leaveRequests.current.delete(id);
                    setNotice('옆 화면의 저장 상태를 확인하지 못했습니다. 작성 내용을 확인하고 다시 시도해 주세요.');
                    resolve(false);
                }, 10000);
                leaveRequests.current.set(id, (allowed) => {
                    clearTimeout(timeout);
                    resolve(allowed);
                });
                post(frame.current.contentWindow, 'leave', id);
            }),
        [post],
    );
    const open = useCallback(
        async (raw: string, label = '관련 내용', right = false, left?: boolean) => {
            const href = workspaceHref(raw, teamId, window.location.origin);
            if (!href) return;
            if (embedded) {
                post(window.parent, 'open', { href, label, right });
                return;
            }
            if (sameDocument(href, window.location.pathname)) {
                setNotice('');
                setActivePane('primary');
                setMobilePane('primary');
                return;
            }
            if (transition.current) return;
            transition.current = true;
            setBusy(true);
            try {
                if (latest.current.secondary?.href !== href && !(await mayClose())) return;
                if (latest.current.secondary?.href !== href) frameReady.current = false;
                if (!latest.current.secondary || left !== undefined) setRatio(50);
                setSecondary({ href, label });
                if (right || !latest.current.secondary) setReversed(left === true);
                setSecondaryPath(href);
                setMobilePane('secondary');
                setActivePane('secondary');
                setNotice('');
            } finally {
                transition.current = false;
                setBusy(false);
            }
        },
        [embedded, mayClose, post, teamId],
    );
    const close = async () => {
        if (transition.current) return;
        transition.current = true;
        setBusy(true);
        try {
            if (await mayClose()) {
                setSecondary(null);
                setActivePane('primary');
                setMobilePane('primary');
                setNotice('');
            }
        } finally {
            transition.current = false;
            setBusy(false);
        }
    };

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            const payload = event.data;
            if (event.origin !== window.location.origin || payload?.protocol !== protocol || payload.teamId !== teamId)
                return;
            const trustedSource = embedded
                ? event.source === window.parent
                : Boolean(frame.current && event.source === frame.current.contentWindow);
            if (!trustedSource) return;
            if (!embedded && payload.type === 'focus') {
                setActivePane('secondary');
                return;
            }
            if (payload.type === 'drag') {
                const reference =
                    payload.data === null ? null : validDragReference(payload.data, teamId, window.location.origin);
                if (payload.data !== null && !reference) return;
                if (embedded) {
                    setDragging(reference);
                    if (!reference) setEdgeOver(null);
                } else drag(reference);
                return;
            }
            if (payload.type === 'resource-event' && resourceEvents.includes(payload.data?.name)) {
                relaying.current = true;
                try {
                    window.dispatchEvent(new CustomEvent(payload.data.name, { detail: payload.data.detail }));
                } finally {
                    relaying.current = false;
                }
                return;
            }
            if (embedded) {
                if (event.source !== window.parent) return;
                if (payload.type === 'pending') setPending(payload.data);
                if (payload.type === 'leave')
                    void canLeaveWorkspacePane()
                        .then((allowed) => post(window.parent, 'leave-result', { id: payload.data, allowed }))
                        .catch(() => post(window.parent, 'leave-result', { id: payload.data, allowed: false }));
            } else {
                if (!frame.current || event.source !== frame.current.contentWindow) return;
                if (payload.type === 'ready') {
                    frameReady.current = true;
                    if (typeof payload.data === 'string' && workspaceHref(payload.data, teamId, window.location.origin))
                        setSecondaryPath(payload.data);
                    post(frame.current.contentWindow, 'pending', latest.current.pending);
                }
                if (payload.type === 'offer') {
                    const value = payload.data;
                    if (
                        value !== null &&
                        (!value ||
                            typeof value.label !== 'string' ||
                            !workspaceHref(value.href, teamId, window.location.origin))
                    )
                        return;
                    offer(value);
                }
                if (payload.type === 'open' && typeof payload.data?.href === 'string')
                    void open(payload.data.href, payload.data.label, payload.data.right === true);
                if (payload.type === 'leave-result') {
                    leaveRequests.current.get(payload.data?.id)?.(payload.data.allowed === true);
                    leaveRequests.current.delete(payload.data?.id);
                }
            }
        };
        window.addEventListener('message', receive);
        if (embedded) post(window.parent, 'ready', window.location.pathname + window.location.search);
        return () => window.removeEventListener('message', receive);
    }, [embedded, offer, open, post, teamId, drag]);
    useEffect(() => {
        const forward = (event: Event) => {
            if (relaying.current) return;
            post(embedded ? window.parent : (frame.current?.contentWindow ?? null), 'resource-event', {
                name: event.type,
                detail: (event as CustomEvent).detail,
            });
        };
        resourceEvents.forEach((name) => window.addEventListener(name, forward));
        return () => resourceEvents.forEach((name) => window.removeEventListener(name, forward));
    }, [embedded, post]);

    useEffect(() => {
        const handleLink = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const anchor =
                event.target instanceof Element
                    ? event.target.closest<HTMLAnchorElement>('.slacord-blocknote a[href], [data-connected-link]')
                    : null;
            if (
                !anchor ||
                anchor.hasAttribute('data-manages-draft-navigation') ||
                anchor.hasAttribute('data-open-in-current-pane') ||
                !workspaceHref(anchor.href, teamId, window.location.origin)
            )
                return;
            event.preventDefault();
            event.stopPropagation();
            void open(anchor.href, anchor.textContent || '관련 내용');
        };
        window.addEventListener('click', handleLink, true);
        return () => window.removeEventListener('click', handleLink, true);
    }, [open, teamId]);
    useEffect(() => {
        if (embedded || !secondary) return;
        const preventDuplicate = (event: MouseEvent) => {
            const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
            if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            if (
                new URL(anchor.href).origin === window.location.origin &&
                sameDocument(new URL(anchor.href).pathname, secondaryPath || secondary.href)
            ) {
                event.preventDefault();
                event.stopPropagation();
                setMobilePane('secondary');
                setActivePane('secondary');
                frame.current?.focus();
                setNotice('');
            }
        };
        window.addEventListener('click', preventDuplicate, true);
        return () => window.removeEventListener('click', preventDuplicate, true);
    }, [embedded, secondary, secondaryPath]);
    useEffect(() => {
        if (embedded) post(window.parent, 'ready', window.location.pathname + window.location.search);
    }, [embedded, pathname, searchParams, post]);
    useEffect(() => {
        if (!embedded) return;
        const focus = () => post(window.parent, 'focus');
        window.addEventListener('pointerdown', focus, true);
        window.addEventListener('focusin', focus);
        return () => {
            window.removeEventListener('pointerdown', focus, true);
            window.removeEventListener('focusin', focus);
        };
    }, [embedded, post]);
    useEffect(() => {
        if (embedded || !secondary || activePane !== 'secondary') return;
        const navigate = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const anchor =
                event.target instanceof Element
                    ? event.target.closest<HTMLAnchorElement>('aside[aria-label="워크스페이스 사이드바"] a[href]')
                    : null;
            if (!anchor || !workspaceHref(anchor.href, teamId, window.location.origin)) return;
            event.preventDefault();
            event.stopPropagation();
            void open(anchor.href, anchor.textContent?.trim() || '페이지');
        };
        window.addEventListener('click', navigate, true);
        return () => window.removeEventListener('click', navigate, true);
    }, [embedded, secondary, activePane, open, teamId]);
    const resize = (clientX: number) => {
        const rect = panes.current?.getBoundingClientRect();
        if (!rect) return;
        const percent = ((clientX - rect.left) / rect.width) * 100;
        setRatio(Math.max(30, Math.min(70, reversed ? 100 - percent : percent)));
    };
    const value = {
        teamId,
        embedded,
        activeHref:
            activePane === 'secondary' && secondary
                ? secondaryPath
                : pathname + (searchParams.size ? '?' + searchParams.toString() : ''),
        activePath: activePane === 'secondary' && secondary ? secondaryPath.split('?')[0] : pathname,
        pending,
        dragging,
        drag,
        offer,
        open: (href: string, label?: string) => {
            void open(href, label, true);
        },
    };
    if (embedded)
        return (
            <WorkspaceConnection.Provider value={value}>
                <div className="workspace-shell connected-embedded h-dvh overflow-auto bg-bg-primary">
                    <main className="h-full min-w-0">{children}</main>
                </div>
            </WorkspaceConnection.Provider>
        );
    return (
        <WorkspaceConnection.Provider value={value}>
            <div className="workspace-shell connected-workspace flex min-h-screen flex-col bg-bg-primary lg:h-screen lg:overflow-hidden">
                <div className="connected-body flex min-h-0 flex-1 flex-col lg:flex-row">
                    {sidebar}
                    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                        {pending && (
                            <div className="connection-reference-tray" role="status">
                                <Link2 size={14} />
                                <span className="truncate">연결할 내용: {pending.label}</span>
                                <span className="hidden text-text-tertiary sm:inline">
                                    작성란에서 ‘본문에 링크 넣기’를 선택하세요.
                                </span>
                                <button
                                    className="connection-icon ml-auto"
                                    aria-label="본문 링크 선택 취소"
                                    onClick={() => offer(null)}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {notice && (
                            <p role="status" className="border-b border-border-primary px-4 py-2 text-xs text-warning">
                                {notice}
                            </p>
                        )}
                        {secondary && (
                            <div
                                className="flex border-b border-border-primary lg:hidden"
                                role="group"
                                aria-label="작업 영역 전환"
                            >
                                <button
                                    aria-pressed={mobilePane === 'primary'}
                                    onClick={() => {
                                        setMobilePane('primary');
                                        setActivePane('primary');
                                    }}
                                    className="flex-1 p-2 text-sm aria-pressed:bg-selection"
                                >
                                    현재 작업
                                </button>
                                <button
                                    aria-pressed={mobilePane === 'secondary'}
                                    onClick={() => {
                                        setMobilePane('secondary');
                                        setActivePane('secondary');
                                    }}
                                    className="min-w-0 flex-1 truncate p-2 text-sm aria-pressed:bg-selection"
                                >
                                    {secondary.label}
                                </button>
                            </div>
                        )}
                        <div
                            ref={panes}
                            className={`connection-panes ${secondary ? 'is-split' : ''} ${reversed ? 'is-reversed' : ''}`}
                            style={{ '--primary-width': `${ratio}%` } as React.CSSProperties}
                        >
                            <div
                                onPointerDownCapture={() => setActivePane('primary')}
                                onFocusCapture={() => setActivePane('primary')}
                                data-active={activePane === 'primary'}
                                className={`connection-primary ${secondary && mobilePane !== 'primary' ? 'mobile-hidden' : ''}`}
                            >
                                <main className="h-full min-w-0 overflow-auto">
                                    {secondary && sameDocument(pathname, secondaryPath) ? (
                                        <div className="p-8">
                                            <h2 className="font-semibold">옆 영역에서 편집 중인 문서입니다.</h2>
                                            <p className="mt-2 text-sm text-text-secondary">
                                                한 문서를 두 번 편집하지 않도록 보호하고 있습니다. 분할을 닫으면 이
                                                영역에서 이어서 작업할 수 있습니다.
                                            </p>
                                            <button
                                                className="connection-open mt-4"
                                                onClick={() => {
                                                    setMobilePane('secondary');
                                                    setActivePane('secondary');
                                                }}
                                            >
                                                편집 중인 영역 보기
                                            </button>
                                        </div>
                                    ) : (
                                        children
                                    )}
                                </main>
                            </div>
                            {secondary && (
                                <>
                                    <div className="connection-divider-controls">
                                        <button
                                            type="button"
                                            className="connection-swap connection-icon"
                                            aria-label="좌우 바꾸기"
                                            title="좌우 바꾸기"
                                            onClick={() => setReversed((value) => !value)}
                                        >
                                            <ArrowLeftRight size={16} />
                                        </button>
                                        <div
                                            role="separator"
                                            tabIndex={0}
                                            aria-label="작업 영역 너비"
                                            aria-orientation="vertical"
                                            aria-valuemin={30}
                                            aria-valuemax={70}
                                            aria-valuenow={Math.round(ratio)}
                                            className="connection-divider"
                                            onKeyDown={(event) => {
                                                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                                    event.preventDefault();
                                                    setRatio(
                                                        Math.max(
                                                            30,
                                                            Math.min(
                                                                70,
                                                                ratio +
                                                                    (event.key === 'ArrowRight' ? 5 : -5) *
                                                                        (reversed ? -1 : 1),
                                                            ),
                                                        ),
                                                    );
                                                }
                                                if (event.key === 'Home') setRatio(50);
                                            }}
                                            onPointerDown={(event) =>
                                                event.currentTarget.setPointerCapture(event.pointerId)
                                            }
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId))
                                                    resize(event.clientX);
                                            }}
                                            onPointerUp={(event) =>
                                                event.currentTarget.releasePointerCapture(event.pointerId)
                                            }
                                        />
                                    </div>
                                    <section
                                        aria-label="옆 작업 영역"
                                        data-active={activePane === 'secondary'}
                                        className={`connection-secondary ${mobilePane !== 'secondary' ? 'mobile-hidden' : ''}`}
                                    >
                                        <button
                                            type="button"
                                            className="connection-pane-close connection-icon"
                                            aria-label="분할 닫기"
                                            title="분할 닫기"
                                            disabled={busy}
                                            onClick={() => void close()}
                                        >
                                            <X size={16} />
                                        </button>
                                        <iframe
                                            ref={frame}
                                            name={`slacord-pane-${teamId}`}
                                            title="연결된 작업 화면"
                                            src={secondary.href}
                                            className="h-full w-full border-0"
                                            allow="microphone; camera; display-capture"
                                            onLoad={() =>
                                                post(
                                                    frame.current?.contentWindow ?? null,
                                                    'pending',
                                                    latest.current.pending,
                                                )
                                            }
                                        />
                                    </section>
                                </>
                            )}
                        </div>
                        {dragging && (splitDragging || dragging.kind === 'issues') && (
                            <div className="workspace-split-preview" aria-label="분할 배치 선택">
                                {(['left', 'right'] as const).map((side) => (
                                    <div
                                        key={side}
                                        data-testid={side === 'right' ? 'workspace-edge-drop' : 'workspace-left-drop'}
                                        className={`workspace-edge-drop is-${side} ${edgeOver === side ? 'is-over' : ''}`}
                                        onDragOver={(event) => {
                                            if (!hasReferenceDrag(event.dataTransfer)) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            event.dataTransfer.dropEffect = 'copy';
                                            setEdgeOver(side);
                                        }}
                                        onDragLeave={() => setEdgeOver(null)}
                                        onDrop={(event) => {
                                            if (!hasReferenceDrag(event.dataTransfer)) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const reference = readReferenceDrag(
                                                event.dataTransfer,
                                                teamId,
                                                window.location.origin,
                                            );
                                            drag(null);
                                            setSplitDragging(false);
                                            if (reference)
                                                void open(reference.href, reference.label, true, side === 'left');
                                        }}
                                    >
                                        <Columns2 size={28} />
                                        <strong>{side === 'left' ? '왼쪽에 열기' : '오른쪽에 열기'}</strong>
                                        <span className="max-w-full truncate">{dragging.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </WorkspaceConnection.Provider>
    );
}
