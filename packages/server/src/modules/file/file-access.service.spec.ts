import { FileAccessService, parseStorageKey } from './file-access.service';
import { byteRange } from '../../shared/storage/infrastructure/byte-range';
import { legacyInlineKeys } from './legacy-file-bindings.service';

describe('private attachments', () => {
    const chat = 'slacord/chat/team/channel/user/2026-10-27/file.png';
    const docKey = 'slacord/docs/team/doc/document/2026-10-27/file.png';
    const inline = 'slacord/docs/team/inline/2026-10-27/file.png';
    const teams = { requireMember: jest.fn() };
    const messages = { ensureChannelMember: jest.fn() };
    const documents = { findById: jest.fn(), findByTeam: jest.fn() };
    const legacy = { documentIds: jest.fn() };
    const access = new FileAccessService(teams as any, messages as any, documents as any, legacy as any);
    beforeEach(() => {
        jest.resetAllMocks();
        teams.requireMember.mockResolvedValue({ role: 'member' });
        messages.ensureChannelMember.mockResolvedValue({ channel: { teamId: 'team' } });
        documents.findById.mockResolvedValue({ teamId: 'team', canView: () => true });
    });
    it('allows members and checks private channel membership before storage access', async () => {
        expect(await access.authorize(chat, 'user')).toBe(chat);
        expect(messages.ensureChannelMember).toHaveBeenCalledWith('channel', 'user');
        messages.ensureChannelMember.mockRejectedValue(new Error('private channel'));
        await expect(access.authorize(chat, 'other-user')).rejects.toThrow();
    });
    it('denies nonmembers and forged cross-team keys', async () => {
        teams.requireMember.mockRejectedValueOnce(new Error('not a member'));
        await expect(access.authorize(chat, 'outsider')).rejects.toThrow();
        messages.ensureChannelMember.mockResolvedValue({ channel: { teamId: 'another-team' } });
        await expect(access.authorize(chat, 'user')).rejects.toThrow();
    });
    it('enforces restricted document access and deletion immediately', async () => {
        expect(await access.authorize(docKey, 'user')).toBe(docKey);
        documents.findById.mockResolvedValue({ teamId: 'team', canView: () => false });
        await expect(access.authorize(docKey, 'user')).rejects.toThrow();
        documents.findById.mockResolvedValue(null);
        await expect(access.authorize(docKey, 'user')).rejects.toThrow();
    });
    it('does not let a copied legacy reference bypass its original document permissions', async () => {
        legacy.documentIds.mockResolvedValue(['original', 'copy']);
        documents.findById.mockResolvedValueOnce({ teamId: 'team', canView: () => false });
        await expect(access.authorize(inline, 'user')).rejects.toThrow();
        expect(await access.authorize(inline, 'user')).toBe(inline);
        documents.findById.mockResolvedValueOnce(null);
        await expect(access.authorize(inline, 'user')).rejects.toThrow();
        legacy.documentIds.mockResolvedValue([]);
        await expect(access.authorize(inline, 'user')).rejects.toThrow();
    });
    it('extracts legacy HTML/JSON references without binding another team', () => {
        expect(legacyInlineKeys(`<img src="https://bucket.kscold.com/slacord/${inline}">`, 'team')).toEqual([inline]);
        expect(
            legacyInlineKeys(JSON.stringify({ url: `/api/files?key=${encodeURIComponent(inline)}` }), 'team'),
        ).toEqual([inline]);
        expect(legacyInlineKeys(inline, 'other')).toEqual([]);
    });
    it.each([
        '../secret',
        'blog/key',
        'slacord/chat/team/../user/date/file',
        'slacord/chat/team/%2e%2e/user/date/file',
        'slacord/chat/team/channel/user/date/file?x',
        ['key'],
    ])('rejects invalid keys %s', (key) => expect(() => parseStorageKey(key)).toThrow());
    it('supports bounded and suffix video ranges without multipart abuse', () => {
        expect(byteRange('bytes=2-5', 10)).toEqual({ start: 2, end: 5, partial: true });
        expect(byteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9, partial: true });
        expect(byteRange('bytes=2-', 10)).toEqual({ start: 2, end: 9, partial: true });
        for (const range of ['bytes=10-', 'bytes=7-2', 'bytes=0-1,3-5', 'bytes=-0', 'bytes=-'])
            expect(() => byteRange(range, 10)).toThrow();
    });
});
