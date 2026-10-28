import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProjectService } from './project.service';

const id = '1234567890abcdef12345678';
const channelId = '2234567890abcdef12345678';
const documentId = '3234567890abcdef12345678';
const project = { id, teamId: 'team', name: 'Work', channelIds: [channelId], documentId, revision: 2 };

describe('project permission and update boundaries', () => {
    let service: ProjectService;
    const projects = {
        findById: jest.fn(),
        findByTeam: jest.fn(),
        findByChannel: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };
    const channels = { findById: jest.fn() };
    const documents = { findById: jest.fn() };
    const messages = { findById: jest.fn() };
    const access = { requireAdmin: jest.fn(), requireMember: jest.fn() };
    beforeEach(() => {
        jest.resetAllMocks();
        access.requireAdmin.mockResolvedValue({ role: 'owner' });
        access.requireMember.mockResolvedValue({ role: 'member' });
        projects.findById.mockResolvedValue(project);
        projects.findByTeam.mockResolvedValue([project]);
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'team', type: 'public' });
        documents.findById.mockResolvedValue({ id: documentId, teamId: 'team', canView: () => true });
        service = new ProjectService(
            projects as never,
            channels as never,
            documents as never,
            access as never,
            messages as never,
            { emit: jest.fn() } as never,
        );
    });
    it('does not query metadata before membership authorization', async () => {
        access.requireMember.mockRejectedValue(new ForbiddenException());
        await expect(service.list('team', 'outsider')).rejects.toThrow(ForbiddenException);
        expect(projects.findByTeam).not.toHaveBeenCalled();
    });
    it('redacts private channel and document IDs from members without access', async () => {
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'team', type: 'private', isMember: () => false });
        documents.findById.mockResolvedValue({ id: documentId, teamId: 'team', canView: () => false });
        const result = await service.list('team', 'member');
        expect(result[0]).toMatchObject({ channelIds: [], documentId: null });
        expect(JSON.stringify(result)).not.toContain(channelId);
        expect(JSON.stringify(result)).not.toContain(documentId);
    });
    it('does not expose foreign resources even with a permissive resource object', async () => {
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'other', type: 'public' });
        documents.findById.mockResolvedValue({ id: documentId, teamId: 'other', canView: () => true });
        expect((await service.list('team', 'member'))[0]).toMatchObject({ channelIds: [], documentId: null });
        await expect(
            service.create('team', 'owner', { name: 'Foreign', channelIds: [channelId], documentId: null }),
        ).rejects.toThrow(BadRequestException);
        expect(projects.save).not.toHaveBeenCalled();
    });
    it('requires admin before validating or writing', async () => {
        access.requireAdmin.mockRejectedValue(new ForbiddenException());
        await expect(
            service.create('team', 'member', { name: 'Work', channelIds: [], documentId: null }),
        ).rejects.toThrow(ForbiddenException);
        expect(projects.save).not.toHaveBeenCalled();
    });
    it('prevents silently removing private bindings not visible to an admin', async () => {
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'team', type: 'private', isMember: () => false });
        await expect(
            service.update('team', 'admin', id, 2, { name: 'Work', channelIds: [], documentId: null }),
        ).rejects.toThrow(BadRequestException);
        expect(projects.update).not.toHaveBeenCalled();
    });
    it('prevents silently clearing a hidden root document', async () => {
        documents.findById.mockResolvedValue({ id: documentId, teamId: 'team', canView: () => false });
        await expect(
            service.update('team', 'admin', id, 2, { name: 'Work', channelIds: [], documentId: null }),
        ).rejects.toThrow(BadRequestException);
        expect(projects.update).not.toHaveBeenCalled();
    });
    it('translates an atomic uniqueness failure and a stale version to conflicts', async () => {
        projects.save.mockRejectedValue({ code: 11000 });
        await expect(
            service.create('team', 'owner', { name: 'Work', channelIds: [], documentId: null }),
        ).rejects.toThrow(ConflictException);
        projects.update.mockResolvedValue(null);
        await expect(
            service.update('team', 'owner', id, 2, { name: 'Work', channelIds: [], documentId: null }),
        ).rejects.toThrow(ConflictException);
        expect(projects.update).toHaveBeenCalledWith(id, 'team', 2, expect.objectContaining({ updatedBy: 'owner' }));
    });
    it('rejects duplicate channel IDs and non-workspace rooms', async () => {
        await expect(
            service.create('team', 'owner', { name: 'Work', channelIds: [channelId, channelId], documentId: null }),
        ).rejects.toThrow(BadRequestException);
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'team', type: 'dm', isMember: () => true });
        await expect(
            service.create('team', 'owner', { name: 'Work', channelIds: [channelId], documentId: null }),
        ).rejects.toThrow(BadRequestException);
    });
    it('ignores reference links and rejects foreign or missing origins', async () => {
        expect(
            await service.fromOrigins('team', 'member', [{ kind: 'message', relation: 'reference', resourceId: id }]),
        ).toBeNull();
        expect(messages.findById).not.toHaveBeenCalled();
        messages.findById.mockResolvedValue({ id, teamId: 'other', channelId });
        await expect(
            service.fromOrigins('team', 'member', [{ kind: 'message', relation: 'origin', resourceId: id }]),
        ).rejects.toThrow('생성 근거');
    });
    it('allows an authorized DM origin without assigning it to a workspace project', async () => {
        messages.findById.mockResolvedValue({ id, teamId: 'team', channelId });
        channels.findById.mockResolvedValue({ id: channelId, teamId: 'team', type: 'dm', isMember: () => true });
        projects.findByTeam.mockResolvedValue([{ ...project, channelIds: [] }]);
        expect(
            await service.fromOrigins('team', 'member', [{ kind: 'message', relation: 'origin', resourceId: id }]),
        ).toBeNull();
    });
});
