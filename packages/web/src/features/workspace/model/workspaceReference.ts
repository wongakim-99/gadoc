export type WorkspaceReference = {
    href: string;
    label: string;
    kind: 'docs' | 'channel' | 'issues' | 'announcements';
};

/** Only existing resource routes in this workspace can enter the split surface. */
export function workspaceHref(value: string, teamId: string, origin: string): string | null {
    try {
        const url = new URL(value, origin);
        if (url.origin !== origin || url.username || url.password) return null;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] !== teamId) return null;
        if (!['docs', 'channel', 'issues', 'announcements'].includes(parts[1])) return null;
        if (parts.length > 3 || (parts.length === 3 && !['docs', 'channel'].includes(parts[1]))) return null;
        if (parts[2] === 'archived') return null;
        url.searchParams.delete('beside');
        url.searchParams.delete('embed');
        return url.pathname + url.search + url.hash;
    } catch {
        return null;
    }
}

export function referenceMarkdown(reference: WorkspaceReference) {
    const label = reference.label.replace(/[\[\]\\\r\n]/g, ' ').slice(0, 120);
    return `[${label}](${reference.href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
}

export function sameDocument(left: string, right: string) {
    const a = left.split(/[?#]/)[0];
    const b = right.split(/[?#]/)[0];
    return /\/docs\/[^/]+$/.test(a) && a === b;
}
