import { IssueRepository } from './issue.repository';
import { CONTENT_CHANGED } from '../../../../shared/interceptors/content-change.interceptor';
import { issueSourceId } from '../../domain/issue-source';

describe('IssueRepository assignment filters', () => {
    it('combines unassigned, status and escaped search within the requested team', async () => {
        const find = jest.fn().mockReturnValue({ sort: () => ({ lean: async () => [] }) });
        const repository = new IssueRepository({ find } as never);
        await repository.findByTeam('team-a', { assigneeId: 'unassigned', status: 'todo', query: '[bug]' });
        expect(find).toHaveBeenCalledWith({
            teamId: 'team-a',
            status: 'todo',
            'assigneeIds.0': { $exists: false },
            $or: [{ title: /\[bug\]/i }, { description: /\[bug\]/i }],
        });
        await repository.findByTeam('team-b', { assigneeId: 'member-b' });
        expect(find).toHaveBeenLastCalledWith({ teamId: 'team-b', assigneeIds: 'member-b' });
        await repository.findByTeam('team-b');
        expect(find).toHaveBeenLastCalledWith({ teamId: 'team-b' });
    });
});

describe('IssueRepository canonical source invalidations', () => {
    it('increments normal edits and emits source-scoped create/update/delete invalidations', async () => {
        const teamId = '111111111111111111111111';
        const doc = {
            _id: '222222222222222222222222',
            teamId,
            title: 'Issue',
            status: 'todo',
            priority: 'medium',
            createdBy: 'author',
            revision: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const model = {
            create: jest.fn(async () => doc),
            findByIdAndUpdate: jest.fn(() => ({ lean: async () => doc })),
            findByIdAndDelete: jest.fn(async () => doc),
        };
        const events = { emit: jest.fn() };
        const repository = new IssueRepository(model as never, events as never);
        await repository.save({
            teamId,
            title: 'Issue',
            description: '',
            priority: 'medium',
            assigneeIds: [],
            labels: [],
            createdBy: 'author',
        });
        const updated = await repository.update(String(doc._id), { title: 'Updated' });
        expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
            doc._id,
            { $set: { title: 'Updated' }, $inc: { revision: 1 } },
            { new: true },
        );
        expect(updated?.revision).toBe(4);
        await repository.deleteById(doc._id);
        expect(events.emit).toHaveBeenCalledTimes(3);
        expect(events.emit).toHaveBeenLastCalledWith(CONTENT_CHANGED, {
            teamId,
            sourceId: issueSourceId(teamId),
            resourceKind: 'issue',
        });
    });
});
