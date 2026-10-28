import { ManageAnnouncementUseCase } from './manage-announcement.use-case';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('announcement mutations', () => {
    const id = '0123456789abcdef01234567';
    let repo: any;
    let service: ManageAnnouncementUseCase;
    beforeEach(() => {
        repo = { findById: jest.fn().mockResolvedValue({ id, teamId: 'team', createdBy: 'author' }),
            updateContent: jest.fn().mockResolvedValue({ id }), deleteById: jest.fn().mockResolvedValue(true) };
        service = new ManageAnnouncementUseCase(repo);
    });
    it('rejects cross-team mutations without writing', async () => {
        await expect(service.delete('other-team', id, 'author', 'owner')).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.deleteById).not.toHaveBeenCalled();
    });
    it('rejects non-author members and guests', async () => {
        for (const [user, role] of [['other', 'member'], ['author', 'guest']]) {
            await expect(service.update('team', id, user, role, { title: 'title', content: 'body' })).rejects.toBeInstanceOf(ForbiddenException);
        }
        expect(repo.updateContent).not.toHaveBeenCalled();
    });
    it('allows authors to edit and administrators to delete', async () => {
        await service.update('team', id, 'author', 'member', { title: ' title ', content: ' body ' });
        expect(repo.updateContent).toHaveBeenCalledWith(id, 'team', 'title', 'body');
        await service.delete('team', id, 'admin-user', 'admin');
        expect(repo.deleteById).toHaveBeenCalledWith(id);
    });
    it('rejects blank content and missing records', async () => {
        await expect(service.update('team', id, 'author', 'member', { title: ' ', content: 'body' })).rejects.toBeInstanceOf(BadRequestException);
        repo.deleteById.mockResolvedValue(false);
        await expect(service.delete('team', id, 'author', 'member')).rejects.toBeInstanceOf(NotFoundException);
    });
});
