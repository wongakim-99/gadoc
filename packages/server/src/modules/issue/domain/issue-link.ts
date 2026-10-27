/** IDs only: titles/content are resolved with the requesting user's current access. */
export interface IssueLink {
    kind: 'document' | 'message';
    resourceId: string;
    relation: 'reference' | 'origin';
}
