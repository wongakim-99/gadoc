'use client';

import { Link2, PanelRightOpen, Plus } from 'lucide-react';
import { useWorkspaceConnection } from '../model/useWorkspaceConnection';
import { referenceMarkdown, workspaceHref, type WorkspaceReference } from '../model/workspaceReference';
import { useWorkspaceDragSource } from '../model/useWorkspaceDragSource';

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

export function WorkspaceReferenceActions({ reference }: { reference: WorkspaceReference }) {
    const connection = useWorkspaceConnection();
    const dragSource = useWorkspaceDragSource(reference);
    if (!connection) return null;
    return (
        <span className="inline-flex shrink-0 items-center gap-1">
            <button
                type="button"
                className="connection-icon"
                title="끌어서 연결 · 클릭하면 참조 준비"
                {...dragSource}
                aria-label={`${reference.label} 참조 준비`}
                onClick={(event) => {
                    event.stopPropagation();
                    connection.offer(reference);
                }}
            >
                <Link2 size={15} />
            </button>
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
            <Plus size={14} /> 참조 넣기: <span className="truncate">{connection.pending.label}</span>
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
        <a
            href={href}
            {...dragSource}
            className="connection-link"
            title="관련 내용을 옆에 열기"
            onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                event.stopPropagation();
                connection.open(href, label);
            }}
        >
            <Link2 size={12} className="inline" /> {label}
        </a>
    );
}
