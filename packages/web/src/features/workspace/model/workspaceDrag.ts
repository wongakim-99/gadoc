import { workspaceHref, type WorkspaceReference } from './workspaceReference';

export const WORKSPACE_REFERENCE_MIME = 'application/x-slacord-reference+json';

export function validDragReference(value: unknown, teamId: string, origin: string): WorkspaceReference | null {
    if (!value || typeof value !== 'object') return null;
    const reference = value as Partial<WorkspaceReference>;
    if (typeof reference.href !== 'string' || typeof reference.label !== 'string' || reference.label.length > 200)
        return null;
    const href = workspaceHref(reference.href, teamId, origin);
    if (!href || new URL(href, origin).pathname.split('/')[2] !== reference.kind) return null;
    return { href, label: reference.label.trim() || '관련 내용', kind: reference.kind };
}

export function writeReferenceDrag(transfer: DataTransfer, reference: WorkspaceReference, origin: string) {
    transfer.effectAllowed = 'copy';
    transfer.setData(WORKSPACE_REFERENCE_MIME, JSON.stringify({ origin, reference }));
}

export function hasReferenceDrag(transfer: Pick<DataTransfer, 'types'>) {
    return Array.from(transfer.types).includes(WORKSPACE_REFERENCE_MIME);
}

export function readReferenceDrag(
    transfer: Pick<DataTransfer, 'getData'>,
    teamId: string,
    origin: string,
): WorkspaceReference | null {
    try {
        const raw = transfer.getData(WORKSPACE_REFERENCE_MIME);
        if (raw.length > 4096) return null;
        const payload = JSON.parse(raw);
        return payload.origin === origin ? validDragReference(payload.reference, teamId, origin) : null;
    } catch {
        return null;
    }
}

export function insertReferenceAtSelection(value: string, reference: string, input: HTMLTextAreaElement | null) {
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    return (
        value.slice(0, start) +
        (start > 0 && !/\s$/.test(value.slice(0, start)) ? '\n' : '') +
        reference +
        (end < value.length ? '\n' : '') +
        value.slice(end)
    );
}
