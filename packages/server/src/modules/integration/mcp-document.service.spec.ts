import { DocumentEntity } from '../document/domain/document.entity';
import { McpDocumentService } from './mcp-document.service';
import type { McpIdentity } from './integration-token.service';

describe('MCP document authorization', () => {
    const documents = { findById: jest.fn(), findMetadataByTeam: jest.fn() };
    const create = { execute: jest.fn() };
    const update = { execute: jest.fn() };
    const upload = { execute: jest.fn() };
    const service = new McpDocumentService(documents as any, create as any, update as any, upload as any);
    const identity: McpIdentity = { tokenId: 'token', teamId: 'team', userId: 'member', role: 'member', scopes: ['documents:read', 'documents:write', 'files:write'] };
    const doc = (overrides: Partial<DocumentEntity> = {}) => Object.assign(new DocumentEntity('doc', 'team', 'Private', '', 'plain', null, 'owner', 'owner', null, null, null, 'restricted', 'all', [], [], null, null, new Date(), new Date()), overrides);
    beforeEach(() => jest.resetAllMocks());

    it('does not reveal private or cross-team documents, including via uploads', async () => {
        for (const row of [doc(), doc({ teamId: 'other', visibility: 'team' }), doc({ visibility: 'team', archivedAt: new Date() })]) {
            documents.findById.mockResolvedValue(row);
            await expect(service.get(identity, 'doc')).rejects.toThrow();
            await expect(service.upload(identity, { documentId: 'doc', filename: 'test.txt', mimeType: 'text/plain', base64: 'dGVzdA==' })).rejects.toThrow();
        }
        expect(upload.execute).not.toHaveBeenCalled();
    });
    it('filters private documents from searches and checks edit permission separately', async () => {
        documents.findMetadataByTeam.mockResolvedValue([doc(), doc({ id: 'public', title: 'Public', visibility: 'team', editPolicy: 'owner_admin' })]);
        expect((await service.list(identity, {})).items.map((row) => row.id)).toEqual(['public']);
        documents.findById.mockResolvedValue(doc({ visibility: 'team', editPolicy: 'owner_admin' }));
        await expect(service.update(identity, { documentId: 'doc', content: 'new', expectedUpdatedAt: new Date().toISOString() })).rejects.toThrow();
        expect(update.execute).not.toHaveBeenCalled();
    });
    it('inherits private parent permissions at insertion, not in a later public-to-private update', async () => {
        documents.findById.mockResolvedValue(doc({ allowedViewerIds: ['member'], allowedEditorIds: ['member'] }));
        create.execute.mockResolvedValue(doc());
        await service.create(identity, { title: 'Child', parentId: 'doc' });
        expect(create.execute).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'restricted', allowedViewerIds: ['member'], parentId: 'doc' }));
    });
    it('rejects malformed JSON blocks and noncanonical file encoding', async () => {
        documents.findById.mockResolvedValue(doc({ visibility: 'team' }));
        await expect(service.create(identity, { title: 'JSON', content: '{}', contentFormat: 'json' })).rejects.toThrow();
        await expect(service.upload(identity, { documentId: 'doc', filename: 'a', mimeType: 'text/plain', base64: 'bad base64!' })).rejects.toThrow();
        expect(upload.execute).not.toHaveBeenCalled();
    });
});
