import type { DocumentNode } from "../api/contracts";

// Missing parents may be hidden by server permissions. Never fetch them by guessing IDs.
export function documentTree(
  nodes: DocumentNode[],
): { node: DocumentNode; depth: number }[] {
  const ids = new Set(nodes.map((node) => node.id));
  const children = new Map<string | null, DocumentNode[]>();
  nodes.forEach((node) => {
    const parent =
      node.parentId && ids.has(node.parentId) ? node.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), node]);
  });
  const visited = new Set<string>();
  const result: { node: DocumentNode; depth: number }[] = [];
  const visit = (root: DocumentNode) => {
    const stack = [{ node: root, depth: 0 }];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current.node.id)) continue;
      visited.add(current.node.id);
      result.push({ node: current.node, depth: Math.min(current.depth, 5) });
      const descendants = children.get(current.node.id) ?? [];
      for (let index = descendants.length - 1; index >= 0; index--) {
        stack.push({ node: descendants[index]!, depth: current.depth + 1 });
      }
    }
  };
  (children.get(null) ?? []).forEach(visit);
  nodes.forEach(visit); // Corrupt cycles still render once.
  return result;
}
