import { MessageMentionsService } from './message-mentions.service';

describe('channel-scoped message mentions', () => {
    const members = ['author', 'alice', 'bob'];
    const teams = { findById: jest.fn() };
    const users = { findByIds: jest.fn() };
    const channels = { findById: jest.fn() };
    const service = new MessageMentionsService(teams as any, users as any, channels as any);
    beforeEach(() => {
        jest.resetAllMocks();
        teams.findById.mockResolvedValue({
            members: members.map((userId) => ({ userId })),
            isMember: (id: string) => members.includes(id),
        });
        users.findByIds.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id, username: id })));
        channels.findById.mockResolvedValue({
            teamId: 'team',
            type: 'public',
            isArchived: false,
            isMember: () => false,
        });
    });
    it('resolves exact usernames, removes self/duplicates and ignores absent accounts', async () => {
        expect(await service.resolve('team', 'room', 'author', '@alice, @bob! @alice @author @missing')).toEqual([
            'alice',
            'bob',
        ]);
    });
    it.each(['@all', '@everyone', '@channel', '@전체'])('expands %s only within the authorized room', async (token) => {
        channels.findById.mockResolvedValue({
            teamId: 'team',
            type: 'private',
            isMember: (id: string) => ['author', 'alice'].includes(id),
        });
        expect(await service.resolve('team', 'room', 'author', token + ' @bob')).toEqual(['alice']);
        expect(users.findByIds).toHaveBeenCalledWith(['author', 'alice']);
    });
    it('does not notify private channel nonmembers even when explicitly typed', async () => {
        channels.findById.mockResolvedValue({
            teamId: 'team',
            type: 'dm',
            isMember: (id: string) => ['author', 'alice'].includes(id),
        });
        expect(await service.resolve('team', 'room', 'author', '@bob @alice')).toEqual(['alice']);
    });
    it('fails closed for cross-team, archived and inaccessible rooms', async () => {
        channels.findById.mockResolvedValue({ teamId: 'other', type: 'public' });
        await expect(service.resolve('team', 'room', 'author', '@all')).rejects.toThrow();
        channels.findById.mockResolvedValue({ teamId: 'team', type: 'public', isArchived: true });
        await expect(service.resolve('team', 'room', 'author', '@all')).rejects.toThrow();
        channels.findById.mockResolvedValue({ teamId: 'team', type: 'private', isMember: () => false });
        await expect(service.resolve('team', 'room', 'author', '@all')).rejects.toThrow();
    });
});
