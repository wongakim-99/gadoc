export function workspaceSlug(name: string, uniqueId: string) {
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || `workspace-${uniqueId}`;
}
