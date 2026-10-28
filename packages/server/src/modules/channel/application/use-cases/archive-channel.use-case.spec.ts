import { ArchiveChannelUseCase } from './archive-channel.use-case';
import { MessageAccessService } from '../../../message/application/services/message-access.service';

describe('channel archive access', () => {
    const channel = {
        id: 'channel',
        teamId: 'team',
        type: 'private',
        createdBy: 'creator',
        isMember: (id: string) => ['creator', 'admin'].includes(id),
        isArchived: false,
    };
    const channels = { findById: jest.fn(), setArchived: jest.fn() };
    const teams = { findById: jest.fn() };
    const member = { role: 'member' };
    const team = { getMember: () => member, hasWriteAccess: () => member.role !== 'guest' };
    const action = new ArchiveChannelUseCase(channels as any, teams as any);
    beforeEach(() => {
        jest.clearAllMocks();
        member.role = 'member';
        channels.findById.mockResolvedValue(channel);
        teams.findById.mockResolvedValue(team);
        channels.setArchived.mockImplementation(async (_id, isArchived) => ({ ...channel, isArchived }));
    });
    it('lets the creator archive and restore without removing content', async () => {
        expect(await action.execute('team', 'channel', 'creator', true)).toMatchObject({ isArchived: true });
        expect(await action.execute('team', 'channel', 'creator', false)).toMatchObject({ isArchived: false });
    });
    it('rejects unrelated users, guests and cross-workspace requests', async () => {
        await expect(action.execute('team', 'channel', 'other', true)).rejects.toThrow();
        member.role = 'guest';
        await expect(action.execute('team', 'channel', 'creator', true)).rejects.toThrow();
        await expect(action.execute('other-team', 'channel', 'creator', true)).rejects.toThrow();
        expect(channels.setArchived).not.toHaveBeenCalled();
    });
    it('does not let an administrator bypass private-channel membership', async () => {
        member.role = 'admin';
        await expect(action.execute('team', 'channel', 'other', true)).rejects.toThrow();
        await expect(action.execute('team', 'channel', 'admin', true)).resolves.toMatchObject({ isArchived: true });
    });
    it('preserves read access but blocks writes to an archived channel', async () => {
        channels.findById.mockResolvedValue({ ...channel, isArchived: true });
        const access = new MessageAccessService(
            channels as any,
            { findById: async () => ({ channelId: 'channel' }) } as any,
            teams as any,
        );
        await expect(access.ensureChannelMember('channel', 'creator')).resolves.toBeDefined();
        await expect(access.ensureChannelWriter('channel', 'creator')).rejects.toThrow('보관된 채널');
        await expect(access.ensureMessageWriter('channel', 'message', 'creator')).rejects.toThrow('보관된 채널');
    });
});
