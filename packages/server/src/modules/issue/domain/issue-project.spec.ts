import { planIssueProjectAssignments, resolveIssueProject, type IssueProject } from './issue-project';
import type { IssueLink } from './issue-link';

const projects: IssueProject[] = [
    { id: 'gadoc', teamId: 'team', name: 'GaDoc', channelIds: ['general', 'feedback', 'features'], documentId: null },
    { id: 'bigzami', teamId: 'team', name: 'Bigzami3', channelIds: ['bigzami3'], documentId: 'bigzami-page' },
];
const messages = ['general', 'feedback', 'features', 'bigzami3'].map((channelId) => ({
    id: `message-${channelId}`,
    teamId: 'team',
    channelId,
}));
const origin = (resourceId: string): IssueLink => ({ kind: 'message', relation: 'origin', resourceId });

describe('workspace issue projects', () => {
    it.each(['general', 'feedback', 'features'])(
        'places %s origins under GaDoc without copying their issues',
        (channel) => {
            expect(resolveIssueProject('team', [origin(`message-${channel}`)], projects, messages)).toEqual({
                projectId: 'gadoc',
                reason: 'matched',
            });
        },
    );

    it('keeps Bigzami3 independent despite GaDoc cross-references', () => {
        const links: IssueLink[] = [
            origin('message-bigzami3'),
            { kind: 'message', resourceId: 'message-general', relation: 'reference' },
            { kind: 'document', resourceId: 'gadoc-page', relation: 'reference' },
        ];
        expect(resolveIssueProject('team', links, projects, messages)).toEqual({
            projectId: 'bigzami',
            reason: 'matched',
        });
    });

    it('does not assign a project from references alone', () => {
        expect(
            resolveIssueProject(
                'team',
                [{ kind: 'message', relation: 'reference', resourceId: 'message-general' }],
                projects,
                messages,
            ).reason,
        ).toBe('no_origin');
    });

    it('does not guess from missing or foreign origins', () => {
        expect(resolveIssueProject('team', [origin('missing')], projects, messages).reason).toBe('missing_origin');
        expect(
            resolveIssueProject('team', [origin('foreign')], projects, [
                { id: 'foreign', teamId: 'other-team', channelId: 'general' },
            ]).reason,
        ).toBe('foreign_origin');
        expect(
            resolveIssueProject('team', [origin('unassigned')], projects, [
                { id: 'unassigned', teamId: 'team', channelId: 'other-channel' },
            ]).reason,
        ).toBe('unassigned_origin');
    });

    it('leaves conflicting origins or overlapping channel bindings for explicit review', () => {
        expect(
            resolveIssueProject('team', [origin('message-general'), origin('message-bigzami3')], projects, messages)
                .reason,
        ).toBe('ambiguous_origin');
        const overlap = [...projects, { ...projects[1], channelIds: ['general'] }];
        expect(resolveIssueProject('team', [origin('message-general')], overlap, messages).reason).toBe(
            'ambiguous_origin',
        );
    });

    it('plans only unclassified same-team issues, keeps versions and does not mutate originals', () => {
        const updatedAt = new Date('2026-10-28T00:00:00.000Z');
        const issues = [
            { id: 'existing-gadoc', teamId: 'team', links: [origin('message-general')], updatedAt },
            { id: 'existing-policy', teamId: 'team', links: [origin('message-bigzami3')], updatedAt },
            {
                id: 'manually-assigned',
                teamId: 'team',
                projectId: 'manual',
                links: [origin('message-general')],
                updatedAt,
            },
            { id: 'foreign', teamId: 'other-team', links: [origin('message-general')], updatedAt },
        ];
        const before = JSON.stringify(issues);
        expect(planIssueProjectAssignments('team', issues, projects, messages)).toEqual({
            assignments: [
                { issueId: 'existing-gadoc', projectId: 'gadoc', expectedUpdatedAt: updatedAt.toISOString() },
                { issueId: 'existing-policy', projectId: 'bigzami', expectedUpdatedAt: updatedAt.toISOString() },
            ],
            skipped: [{ issueId: 'manually-assigned', reason: 'already_classified' }],
        });
        expect(JSON.stringify(issues)).toBe(before);
    });
});
