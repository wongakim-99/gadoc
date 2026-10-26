'use client';

import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import { useWorkspaceConnection } from '../model/useWorkspaceConnection';
import { hasReferenceDrag, readReferenceDrag } from '../model/workspaceDrag';
import { referenceMarkdown, type WorkspaceReference } from '../model/workspaceReference';

export function WorkspaceReferenceDropZone({
    children,
    disabled = false,
    label = '여기에 참조 추가',
    onInsert,
    onHover,
}: {
    children: ReactNode;
    disabled?: boolean;
    label?: string;
    onInsert: (reference: WorkspaceReference, markdown: string, event: DragEvent<HTMLDivElement>) => void;
    onHover?: (target: EventTarget | null) => void;
}) {
    const connection = useWorkspaceConnection();
    const [over, setOver] = useState(false);
    useEffect(() => {
        if (!connection?.dragging) {
            setOver(false);
            onHover?.(null);
        }
    }, [connection?.dragging, onHover]);
    return (
        <div
            className={`reference-drop-zone ${over ? 'is-drag-over' : ''}`}
            data-reference-drop-zone
            onDragEnterCapture={(event) => {
                if (hasReferenceDrag(event.dataTransfer)) event.preventDefault();
            }}
            onDragOverCapture={(event) => {
                if (!hasReferenceDrag(event.dataTransfer)) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
                setOver(true);
                onHover?.(event.target);
            }}
            onDragLeaveCapture={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                    setOver(false);
                    onHover?.(null);
                }
            }}
            onDropCapture={(event) => {
                if (!hasReferenceDrag(event.dataTransfer)) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(false);
                onHover?.(null);
                const reference =
                    connection && readReferenceDrag(event.dataTransfer, connection.teamId, window.location.origin);
                if (reference && !disabled) onInsert(reference, referenceMarkdown(reference), event);
                connection?.drag(null);
            }}
        >
            {over && (
                <div className="reference-drop-hint" aria-live="polite">
                    <Link2 size={14} />
                    {disabled ? '읽기 전용 · 참조를 추가할 수 없습니다' : label}
                </div>
            )}
            {children}
        </div>
    );
}
