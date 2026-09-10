import { DocumentEntity } from './document.entity';

function createDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
    return new DocumentEntity(
        (overrides.id as string) ?? 'doc-1',
        (overrides.teamId as string) ?? 'team-1',
        (overrides.title as string) ?? '테스트 문서',
        (overrides.content as string) ?? '',
        (overrides.contentFormat as 'plain' | 'html' | 'json') ?? 'plain',
        (overrides.parentId as string | null) ?? null,
        (overrides.createdBy as string) ?? 'user-owner',
        (overrides.updatedBy as string) ?? 'user-owner',
        null,
        null,
        null,
        (overrides.visibility as 'team' | 'restricted') ?? 'team',
        (overrides.editPolicy as 'owner_admin' | 'all' | 'restricted') ?? 'owner_admin',
        (overrides.allowedViewerIds as string[]) ?? [],
        (overrides.allowedEditorIds as string[]) ?? [],
        (overrides.archivedAt as Date | null) ?? null,
        (overrides.archivedBy as string | null) ?? null,
        new Date(),
        new Date(),
    );
}

describe('DocumentEntity', () => {
    describe('isArchived', () => {
        it('archivedAt이 null이면 false', () => {
            expect(createDoc().isArchived).toBe(false);
        });
        it('archivedAt이 있으면 true', () => {
            expect(createDoc({ archivedAt: new Date() }).isArchived).toBe(true);
        });
    });

    describe('canView', () => {
        it('owner/admin은 항상 볼 수 있음', () => {
            const doc = createDoc({ visibility: 'restricted' });
            expect(doc.canView('anyone', 'owner')).toBe(true);
            expect(doc.canView('anyone', 'admin')).toBe(true);
        });
        it('team visibility면 member도 볼 수 있음', () => {
            const doc = createDoc({ visibility: 'team' });
            expect(doc.canView('user-member', 'member')).toBe(true);
        });
        it('restricted에서 allowedViewerIds에 없으면 못 봄', () => {
            const doc = createDoc({ visibility: 'restricted', allowedViewerIds: ['user-a'] });
            expect(doc.canView('user-b', 'member')).toBe(false);
        });
        it('restricted에서 allowedViewerIds에 있으면 볼 수 있음', () => {
            const doc = createDoc({ visibility: 'restricted', allowedViewerIds: ['user-a'] });
            expect(doc.canView('user-a', 'member')).toBe(true);
        });
        it('restricted에서 작성자는 볼 수 있음', () => {
            const doc = createDoc({ visibility: 'restricted', createdBy: 'user-creator' });
            expect(doc.canView('user-creator', 'member')).toBe(true);
        });
    });

    describe('canEdit', () => {
        it('owner는 항상 편집 가능', () => {
            expect(createDoc().canEdit('anyone', 'owner')).toBe(true);
        });
        it('editPolicy=all이면 모두 편집 가능', () => {
            const doc = createDoc({ editPolicy: 'all' });
            expect(doc.canEdit('user-member', 'member')).toBe(true);
        });
        it('editPolicy=owner_admin이면 admin과 작성자만', () => {
            const doc = createDoc({ editPolicy: 'owner_admin', createdBy: 'user-creator' });
            expect(doc.canEdit('user-admin', 'admin')).toBe(true);
            expect(doc.canEdit('user-creator', 'member')).toBe(true);
            expect(doc.canEdit('user-other', 'member')).toBe(false);
        });
        it('editPolicy=restricted이면 allowedEditorIds와 작성자만', () => {
            const doc = createDoc({
                editPolicy: 'restricted',
                allowedEditorIds: ['user-a'],
                createdBy: 'user-creator',
            });
            expect(doc.canEdit('user-a', 'member')).toBe(true);
            expect(doc.canEdit('user-creator', 'member')).toBe(true);
            expect(doc.canEdit('user-b', 'member')).toBe(false);
        });
    });

    describe('canDelete', () => {
        it('owner/admin은 삭제 가능', () => {
            expect(createDoc().canDelete('anyone', 'owner')).toBe(true);
            expect(createDoc().canDelete('anyone', 'admin')).toBe(true);
        });
        it('작성자는 삭제 가능', () => {
            const doc = createDoc({ createdBy: 'user-creator' });
            expect(doc.canDelete('user-creator', 'member')).toBe(true);
        });
        it('일반 멤버는 삭제 불가', () => {
            expect(createDoc().canDelete('user-other', 'member')).toBe(false);
        });
    });

    describe('toPublic / toTreeNode', () => {
        it('toPublic에 content 포함', () => {
            const doc = createDoc({ content: 'hello' });
            expect(doc.toPublic().content).toBe('hello');
        });
        it('toTreeNode에 content 미포함', () => {
            const doc = createDoc({ content: 'hello' });
            expect((doc.toTreeNode() as Record<string, unknown>).content).toBeUndefined();
        });
    });
});
