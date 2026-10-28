'use client';

import { Link2, PanelRightOpen, Plus } from 'lucide-react';
import { useWorkspaceConnection } from '../model/useWorkspaceConnection';
import { referenceMarkdown, workspaceHref, type WorkspaceReference } from '../model/workspaceReference';
import { useWorkspaceDragSource } from '../model/useWorkspaceDragSource';
import { ResourceNavigation } from './ResourceNavigation';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function WorkspaceOpenButton({ reference }: { reference: WorkspaceReference }) {
    const connection = useWorkspaceConnection();
    if (!connection) return null;
    return (
        <button
            type="button"
            className="connection-icon workspace-inline-open"
            title="옆에 열기"
            aria-label={`${reference.label} 옆에 열기`}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                connection.open(reference.href, reference.label);
            }}
        >
            <PanelRightOpen size={15} />
        </button>
    );
}

export function WorkspaceReferenceActions({
    reference,
    onMenuOpenChange,
}: {
    reference: WorkspaceReference;
    onMenuOpenChange?: (open: boolean) => void;
}) {
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDetailsElement>(null);
    const connection = useWorkspaceConnection();
    const dragSource = useWorkspaceDragSource(reference);
    if (!connection) return null;
    return (
        <span className="inline-flex shrink-0 items-center gap-1">
            <details
                ref={menuRef}
                className="relative"
                onClick={(event) => event.stopPropagation()}
                onToggle={(event) => {
                    setMenuOpen(event.currentTarget.open);
                    onMenuOpenChange?.(event.currentTarget.open);
                    if (!event.currentTarget.open) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setPosition({
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)),
                        top: Math.min(rect.bottom + 4, window.innerHeight - 120),
                    });
                }}
            >
                <summary
                    className="connection-icon list-none cursor-pointer"
                    title="끌어서 연결 · 연결 메뉴"
                    {...dragSource}
                    aria-label={`${reference.label} 연결 메뉴`}
                >
                    <Link2 size={15} />
                </summary>
                {menuOpen &&
                    createPortal(
                        <div
                            style={position}
                            className="fixed z-[90] w-56 rounded-control border border-border-primary bg-bg-secondary p-2 shadow-lg"
                        >
                            <button
                                type="button"
                                className="w-full rounded-control p-2 text-left text-xs hover:bg-bg-hover"
                                onClick={() => {
                                    connection.offer(reference);
                                    if (menuRef.current) menuRef.current.open = false;
                                    setMenuOpen(false);
                                    onMenuOpenChange?.(false);
                                }}
                            >
                                다른 본문에 링크 넣기
                            </button>
                        </div>,
                        document.body,
                    )}
            </details>
            <WorkspaceOpenButton reference={reference} />
        </span>
    );
}

export function InsertWorkspaceReference({
    onInsert,
    disabled = false,
}: {
    onInsert: (reference: WorkspaceReference, markdown: string) => void;
    disabled?: boolean;
}) {
    const connection = useWorkspaceConnection();
    if (!connection?.pending || disabled) return null;
    return (
        <button
            type="button"
            className="connection-insert"
            onClick={() => {
                if (!connection.pending) return;
                onInsert(connection.pending, referenceMarkdown(connection.pending));
                connection.offer(null);
            }}
        >
            <Plus size={14} /> 본문에 링크 넣기: <span className="truncate">{connection.pending.label}</span>
        </button>
    );
}

/** Existing plain-text fields store portable markdown links, never copied source bodies. */
export function ConnectedText({ text }: { text: string }) {
    const connection = useWorkspaceConnection();
    const parts = text.split(/(\[[^\]\n]{1,120}\]\([^\s)]+\))/g);
    return (
        <>
            {parts.map((part, index) => {
                const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
                const href =
                    match && connection && typeof window !== 'undefined'
                        ? workspaceHref(match[2], connection.teamId, window.location.origin)
                        : null;
                if (!match || !href || !connection) return <span key={index}>{part}</span>;
                return <ConnectedReferenceLink key={index} href={href} label={match[1]} />;
            })}
        </>
    );
}

function ConnectedReferenceLink({ href, label }: { href: string; label: string }) {
    const connection = useWorkspaceConnection();
    const reference = { href, label, kind: href.split(/[?#]/)[0].split('/')[2] as WorkspaceReference['kind'] };
    const dragSource = useWorkspaceDragSource(reference);
    if (!connection) return <span>{label}</span>;
    return (
        <span {...dragSource} className="inline-flex max-w-full items-center gap-1 align-middle">
            <Link2 size={12} />
            <ResourceNavigation href={href} title={label} />
        </span>
    );
}
