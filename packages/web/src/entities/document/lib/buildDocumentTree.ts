import type { DocumentNode } from '../types';

export interface DocumentTreeNode extends DocumentNode {
    databaseId?: string;
    children: DocumentTreeNode[];
}

export function buildDocumentTree(documents: DocumentNode[]) {
    const byId = new Map(documents.map((document) => [document.id, document]));
    // Database records (and their nested pages) belong to the database, not the sidebar.
    const navigationDocuments = documents.filter((document) => {
        let current: DocumentNode | undefined = document;
        const visited = new Set<string>();
        while (current && !visited.has(current.id)) {
            if (current.isDatabasePage) return false;
            visited.add(current.id);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return true;
    });
    const nodes = new Map<string, DocumentTreeNode>(
        navigationDocuments.map((document) => [document.id, { ...document, children: [] }] as const),
    );
    const roots: DocumentTreeNode[] = [];

    for (const node of nodes.values()) {
        if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId)?.children.push(node);
            continue;
        }
        roots.push(node);
    }

    return roots;
}
