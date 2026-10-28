import { IssueRepository } from './issue.repository';

describe('IssueRepository assignment filters', () => {
    it('combines unassigned, status and escaped search within the requested team', async () => {
        const find = jest.fn().mockReturnValue({ sort: () => ({ lean: async () => [] }) });
        const repository = new IssueRepository({ find } as never);
        await repository.findByTeam('team-a', { assigneeId: 'unassigned', status: 'todo', query: '[bug]' });
        expect(find).toHaveBeenCalledWith({
            teamId: 'team-a', status: 'todo', 'assigneeIds.0': { $exists: false },
            $or: [{ title: /\[bug\]/i }, { description: /\[bug\]/i }],
        });
        await repository.findByTeam('team-b', { assigneeId: 'member-b' });
        expect(find).toHaveBeenLastCalledWith({ teamId: 'team-b', assigneeIds: 'member-b' });
        await repository.findByTeam('team-b');
        expect(find).toHaveBeenLastCalledWith({ teamId: 'team-b' });
    });
});
