import { ManageChannelUseCase } from './manage-channel.use-case';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
describe('channel management', () => {
    const id = '0123456789abcdef01234567';
    let channels: any, teams: any, service: ManageChannelUseCase, channel: any, role: string;
    beforeEach(() => {
        role = 'member';
        channel = { id, teamId: 'team', type: 'public', createdBy: 'creator', isMember: jest.fn().mockReturnValue(false) };
        channels = { findById: jest.fn().mockResolvedValue(channel), updateDetails: jest.fn().mockResolvedValue(channel), deleteInTeam: jest.fn().mockResolvedValue(true) };
        teams = { findById: jest.fn().mockResolvedValue({ getMember: () => ({ role }) }) };
        service = new ManageChannelUseCase(channels, teams);
    });
    it('allows the creator to rename and delete a public channel', async () => {
        await service.update('team', id, 'creator', { name: ' renamed ', description: ' note ' });
        expect(channels.updateDetails).toHaveBeenCalledWith(id, 'team', 'renamed', 'note');
        await service.delete('team', id, 'creator');
        expect(channels.deleteInTeam).toHaveBeenCalledWith(id, 'team');
    });
    it('rejects other members, guests and cross-team IDs', async () => {
        await expect(service.delete('team', id, 'other')).rejects.toBeInstanceOf(ForbiddenException);
        role = 'guest';
        await expect(service.delete('team', id, 'creator')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.delete('foreign', id, 'creator')).rejects.toBeInstanceOf(NotFoundException);
        expect(channels.deleteInTeam).not.toHaveBeenCalled();
    });
    it('requires private channel access even for administrators and excludes DMs', async () => {
        role = 'admin'; channel.type = 'private';
        await expect(service.delete('team', id, 'admin')).rejects.toBeInstanceOf(ForbiddenException);
        channel.isMember.mockReturnValue(true); channel.type = 'dm';
        await expect(service.delete('team', id, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('reports duplicate names as conflicts', async () => {
        channels.updateDetails.mockRejectedValue({ code: 11000 });
        await expect(service.update('team', id, 'creator', { name: 'duplicate' })).rejects.toBeInstanceOf(ConflictException);
    });
});
