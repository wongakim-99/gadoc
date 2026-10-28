import { IssueLinksService } from './issue-links.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Issue links access and persistence boundary', () => {
    const docId = '111111111111111111111111';
    const msgId = '222222222222222222222222';
    const issueId = '333333333333333333333333';
    const issue = () => ({
        id: issueId,
        teamId: 'team',
        links: [
            { kind: 'document', resourceId: docId, relation: 'reference' },
            { kind: 'message', resourceId: msgId, relation: 'origin' },
        ],
    });
    let service: IssueLinksService;
    let issues: any, documents: any, messages: any, channels: any, access: any;
    beforeEach(() => {
        issues = {
            findById: jest.fn().mockResolvedValue(issue()),
            findLinked: jest.fn().mockResolvedValue([]),
            addLink: jest.fn().mockResolvedValue(true),
            removeLink: jest.fn(),
        };
        documents = {
            findById: jest.fn().mockResolvedValue({
                id: docId,
                teamId: 'team',
                title: '현재 문서 제목',
                isArchived: false,
                canView: () => true,
            }),
        };
        messages = {
            findById: jest.fn().mockResolvedValue({
                id: msgId,
                teamId: 'team',
                channelId: 'channel',
                content: '논의',
                createdAt: new Date(),
            }),
        };
        channels = {
            findById: jest.fn().mockResolvedValue({
                id: 'channel',
                teamId: 'team',
                type: 'public',
                name: 'general',
                isMember: () => false,
            }),
        };
        access = {
            requireMember: jest.fn().mockResolvedValue({ role: 'member' }),
            requireWritableMember: jest.fn().mockResolvedValue({ role: 'member' }),
        };
        service = new IssueLinksService(issues, documents, messages, channels, access);
    });
    it('resolves current titles and the origin only for visible resources', async () => {
        const result = await service.list('team', 'user', issueId);
        expect(result).toHaveLength(2);
        expect(result[0]?.title).toBe('현재 문서 제목');
        expect(result[1]?.relation).toBe('origin');
    });
    it('does not expose IDs, titles or counts for restricted documents and private messages', async () => {
        documents.findById.mockResolvedValue({ teamId: 'team', isArchived: false, canView: () => false });
        channels.findById.mockResolvedValue({ teamId: 'team', type: 'private', isMember: () => false });
        expect(await service.list('team', 'user', issueId)).toEqual([]);
        await expect(service.source('team', 'user', msgId)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('rejects cross-team issues and resources before mutation', async () => {
        issues.findById.mockResolvedValue({ ...issue(), teamId: 'another' });
        await expect(service.add('team', 'user', issueId, 'document', docId)).rejects.toBeInstanceOf(NotFoundException);
        expect(issues.addLink).not.toHaveBeenCalled();
        issues.findById.mockResolvedValue(issue());
        messages.findById.mockResolvedValue({ teamId: 'another' });
        await expect(service.source('team', 'user', msgId)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('does not permit guests to create or remove relationships', async () => {
        access.requireWritableMember.mockRejectedValue(new ForbiddenException());
        await expect(service.add('team', 'guest', issueId, 'document', docId)).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        await expect(service.remove('team', 'guest', issueId, 'document', docId)).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        expect(issues.addLink).not.toHaveBeenCalled();
        expect(issues.removeLink).not.toHaveBeenCalled();
    });
    it('hides archived/deleted sources and denies reverse queries to inaccessible resources', async () => {
        documents.findById.mockResolvedValue({ teamId: 'team', isArchived: true, canView: () => true });
        messages.findById.mockResolvedValue(null);
        expect(await service.list('team', 'user', issueId)).toEqual([]);
        await expect(service.related('team', 'user', 'document', docId)).rejects.toBeInstanceOf(NotFoundException);
        expect(issues.findLinked).not.toHaveBeenCalled();
    });
    it('keeps duplicate linking idempotent without changing origin meaning', async () => {
        issues.addLink.mockResolvedValue(false);
        const result = await service.add('team', 'user', issueId, 'message', msgId);
        expect(result.created).toBe(false);
        expect(result.links).toHaveLength(2);
    });
    it('does not swallow database failures as empty permission-filtered lists', async () => {
        documents.findById.mockRejectedValue(new Error('offline'));
        await expect(service.list('team', 'user', issueId)).rejects.toThrow('offline');
    });
    it('shows a visible document path without leaking restricted ancestors or looping on cycles', async () => {
        documents.findById.mockImplementation(async (id: string) => ({
            id,
            teamId: 'team',
            isArchived: false,
            canView: () => id !== 'secret',
            title: id === docId ? '하위 문서' : id === 'parent' ? '상위 문서' : '비공개 제목',
            parentId: id === docId ? 'parent' : 'secret',
        }));
        const result = await service.list('team', 'user', issueId);
        expect(result[0]?.location).toBe('문서 / 상위 문서 / 하위 문서');
        expect(JSON.stringify(result)).not.toContain('비공개 제목');
        documents.findById.mockImplementation(async (id: string) => ({
            id,
            teamId: 'team',
            title: '순환 문서',
            parentId: docId,
            isArchived: false,
            canView: () => true,
        }));
        expect((await service.list('team', 'user', issueId))[0]?.location).toBe('문서 / 순환 문서');
    });
    it('links replies through parent resolution instead of highlighting them in the main list', async () => {
        messages.findById.mockResolvedValue({
            id: msgId,
            teamId: 'team',
            channelId: 'channel',
            content: '답글 근거',
            replyToId: 'parent',
            createdAt: new Date('2026-10-28T01:00:00.000Z'),
        });
        const result = await service.list('team', 'user', issueId);
        expect(result[1]?.href).toBe(`/team/channel/channel?message=${msgId}`);
        expect(result[1]?.location).toBe('#general / 스레드 답글 / 2026-10-28T01:00:00.000Z');
    });
});
