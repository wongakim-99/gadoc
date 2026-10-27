import { ForbiddenException } from '@nestjs/common';
import { IntegrationTokenService, tokenDigest, type McpIdentity } from './integration-token.service';

describe('MCP connection credentials', () => {
    const collection = { insertOne: jest.fn(), countDocuments: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() };
    const teams = { requireMember: jest.fn() };
    const service = new IntegrationTokenService({ collection: () => collection } as any, teams as any);
    beforeEach(() => { jest.resetAllMocks(); teams.requireMember.mockResolvedValue({ role: 'member' }); collection.countDocuments.mockResolvedValue(0); });

    it('returns the secret once and persists only a digest', async () => {
        const result = await service.issue('team', 'user', { name: 'AI', scopes: ['documents:read'] });
        expect(result.token).toMatch(/^gd_mcp_[A-Za-z0-9_-]{43}$/);
        const stored = collection.insertOne.mock.calls[0][0];
        expect(stored.digest).toBe(tokenDigest(result.token));
        expect(JSON.stringify(stored)).not.toContain(result.token);
        expect(result).not.toHaveProperty('digest');
        expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(30 * 86_400_000);
    });
    it('rejects unknown scopes, non-expiring tokens and guest write grants', async () => {
        for (const input of [{ name: 'AI', scopes: ['admin'] }, { name: 'AI', scopes: ['documents:read'], expiresInDays: 0 }, { name: 'AI', scopes: ['documents:read'], teamId: 'other' }]) {
            await expect(service.issue('team', 'user', input)).rejects.toThrow();
        }
        teams.requireMember.mockResolvedValue({ role: 'guest' });
        await expect(service.issue('team', 'user', { name: 'AI', scopes: ['files:write'] })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('requires live, unrevoked credentials and checks membership on every request', async () => {
        const issued = await service.issue('team', 'user', { name: 'AI', scopes: ['documents:read'] });
        const row = collection.insertOne.mock.calls[0][0];
        collection.findOne.mockResolvedValue(row);
        const identity = await service.authenticate(`Bearer ${issued.token}`);
        expect(identity.teamId).toBe('team');
        expect(collection.findOne).toHaveBeenCalledWith(expect.objectContaining({ digest: row.digest, revokedAt: null, expiresAt: { $gt: expect.any(Date) } }));
        teams.requireMember.mockRejectedValue(new ForbiddenException());
        await expect(service.authenticate(`Bearer ${issued.token}`)).rejects.toThrow();
        collection.findOne.mockResolvedValue(null);
        await expect(service.authenticate(`Bearer ${issued.token}`)).rejects.toThrow();
        await expect(service.authenticate('Bearer jwt-token')).rejects.toThrow();
    });
    it('does not let a downgraded guest retain write scope', () => {
        const identity = { role: 'guest', scopes: ['documents:write'] } as McpIdentity;
        expect(() => service.requireScope(identity, 'documents:write')).toThrow();
    });
});
