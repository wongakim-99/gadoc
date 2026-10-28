import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateIssueUseCase } from './create-issue.use-case';
import { UpdateIssueUseCase } from './update-issue.use-case';

describe('canonical issue assignment membership', () => {
    it('rejects a stale issue form without writing its revision as a field', async () => {
        const repository = { findById: jest.fn(async () => ({ teamId: 'team', assigneeIds: [] })), update: jest.fn(async () => null) };
        const update = new UpdateIssueUseCase(repository as never, {} as never, {} as never);
        await expect(update.execute({ id: 'issue', title: 'Draft', revision: 3 })).rejects.toBeInstanceOf(ConflictException);
        expect(repository.update).toHaveBeenCalledWith('issue', { title: 'Draft' }, 3);
    });
    it('rejects foreign assignees on regular issue create and update before writing', async () => {
        const repository = {
            findById: jest.fn(async () => ({ teamId: 'team', assigneeIds: [] })),
            save: jest.fn(),
            update: jest.fn(),
        };
        const teams = {
            findById: jest.fn(async () => ({ getMember: (id: string) => (id === 'member' ? {} : undefined) })),
        };
        const create = new CreateIssueUseCase(repository as never, teams as never, {} as never);
        const update = new UpdateIssueUseCase(repository as never, teams as never, {} as never);
        await expect(
            create.execute({ teamId: 'team', title: 'Issue', createdBy: 'member', assigneeIds: ['foreign'] }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(update.execute({ id: 'issue', assigneeIds: ['foreign'] })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(repository.save).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
    });
});
