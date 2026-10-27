import type { DocumentNode } from '../types';

/** Traverse visible documents only, including malformed cyclic hierarchies safely. */
export function getDocumentAncestors(documents: DocumentNode[], documentId: string) {
    const byId = new Map(documents.map((doc) => [doc.id, doc]));
    const visited = new Set([documentId]);
    const ancestors: DocumentNode[] = [];
    let parentId = byId.get(documentId)?.parentId;
    while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        ancestors.unshift(parent);
        parentId = parent.parentId;
    }
    return ancestors;
}
