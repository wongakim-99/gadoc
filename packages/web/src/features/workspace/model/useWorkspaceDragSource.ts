'use client';

import type { DragEvent } from 'react';
import { useWorkspaceConnection } from './useWorkspaceConnection';
import { writeReferenceDrag } from './workspaceDrag';
import type { WorkspaceReference } from './workspaceReference';

export function useWorkspaceDragSource(reference: WorkspaceReference) {
    const connection = useWorkspaceConnection();
    return {
        draggable: Boolean(connection),
        onDragStart: (event: DragEvent<HTMLElement>) => {
            if (!connection) return;
            event.stopPropagation();
            writeReferenceDrag(event.dataTransfer, reference, window.location.origin);
            connection.drag(reference);
        },
        onDragEnd: () => connection?.drag(null),
    };
}
