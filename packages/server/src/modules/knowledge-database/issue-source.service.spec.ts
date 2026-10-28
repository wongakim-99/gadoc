import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IssueSourceService, ISSUE_PROPERTIES } from './issue-source.service';
import { DatabaseService } from './database.service';
import type { PropertyValue } from './database.schema';
import { DatabaseContainerService } from './container.service';
import { issueSourceId } from '../issue/domain/issue-source';
import { CONTENT_CHANGED } from '../../shared/interceptors/content-change.interceptor';
import { NOTIFICATION_EVENTS } from '../../shared/events/notification-events';

const teamId = '111111111111111111111111';
const issueId = '222222222222222222222222';
const otherId = '333333333333333333333333';
const userId = 'author';
const sourceId = issueSourceId(teamId);
const query = (value: unknown) => ({ lean: async () => value, sort: () => ({ lean: async () => value }) });

describe('canonical issue database source', () => {
    let service: IssueSourceService;
    let database: DatabaseService;
    let issues: any;
    let sources: any;
    let events: any;
    let access: any;
    let documents: any;
    let source: any;
    let canonical: any;
    beforeEach(() => {
        canonical = {
            _id: issueId,
            teamId,
            title: '채팅 이슈',
            description: '원본',
            status: 'todo',
            priority: 'high',
            assigneeIds: ['member'],
            labels: ['bug'],
            createdBy: userId,
            links: [{ kind: 'message', resourceId: otherId, relation: 'origin' }],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
        };
        source = {
            _id: sourceId,
            teamId,
            name: '워크스페이스 이슈',
            sourceKind: 'issues',
            properties: ISSUE_PROPERTIES,
            views: [],
            revision: 0,
            createdBy: userId,
        };
        issues = {
            find: jest.fn(() => query([canonical])),
            findOne: jest.fn(({ teamId: requestedTeam }) => query(requestedTeam === teamId ? { ...canonical } : null)),
            findById: jest.fn(() => query(null)),
            create: jest.fn(async (data) => {
                canonical = { ...canonical, ...data };
                return canonical;
            }),
            updateOne: jest.fn(async (filter, update) => {
                const expected = filter.$or ? 0 : filter.revision;
                if ((canonical.revision ?? 0) !== expected) return { modifiedCount: 0 };
                Object.assign(canonical, update.$set, { revision: expected + 1 });
                return { modifiedCount: 1 };
            }),
        };
        sources = {
            findOne: jest.fn(({ teamId: requestedTeam }) => query(requestedTeam === teamId ? source : null)),
            find: jest.fn(() => query([source])),
            updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
        };
        const team = {
            members: [
                { userId, role: 'member' },
                { userId: 'member', role: 'member' },
            ],
            getMember: (id: string) => ([userId, 'member'].includes(id) ? { userId: id, role: 'member' } : undefined),
        };
        const teams = { findById: jest.fn(async () => team) };
        access = {
            requireMember: jest.fn(async () => ({ role: 'member' })),
            requireWritableMember: jest.fn(async () => ({ role: 'member' })),
        };
        events = { emit: jest.fn() };
        documents = { findMetadataByTeam: jest.fn(async () => []), findById: jest.fn() };
        service = new IssueSourceService(issues, sources, access, teams as never, events);
        database = new DatabaseService(
            sources,
            {} as never,
            documents,
            teams as never,
            access,
            events,
            {} as never,
            service,
        );
    });

    it('provisions one deterministic team source across callers and lists/wraps it', async () => {
        expect(issueSourceId(teamId)).not.toBe(issueSourceId(otherId));
        expect(await database.provisionIssueSource(teamId, userId)).toEqual(
            await database.provisionIssueSource(teamId, 'member'),
        );
        expect(sources.updateOne).toHaveBeenCalledWith(
            { _id: sourceId, teamId, sourceKind: 'issues' },
            expect.objectContaining({ $setOnInsert: expect.objectContaining({ properties: ISSUE_PROPERTIES }) }),
            { upsert: true },
        );
        expect(await database.list(teamId, userId)).toEqual([
            expect.objectContaining({ id: sourceId, sourceKind: 'issues' }),
        ]);
        const containers = {
            findOne: jest
                .fn()
                .mockReturnValueOnce(query(null))
                .mockReturnValue(query({ _id: sourceId, name: source.name, sourceIds: [sourceId], revision: 0 })),
            updateOne: jest.fn(),
        };
        const container = new DatabaseContainerService(containers as never, sources, database, access);
        expect((await container.read(teamId, userId, sourceId)).sources[0].sourceKind).toBe('issues');
    });

    it('projects existing and future canonical issues with no document or row copies', async () => {
        const detail = await database.read(teamId, userId, sourceId);
        expect(detail).toMatchObject({
            sourceKind: 'issues',
            canEditSchema: false,
            rows: [
                {
                    documentId: issueId,
                    title: '채팅 이슈',
                    resourceKind: 'issue',
                    revision: 0,
                    canEdit: true,
                    availablePersonIds: [userId, 'member'],
                    relations: {},
                    values: {
                        status: '할 일',
                        owner: ['member'],
                        priority: '높음',
                        labels: ['bug'],
                        description: '원본',
                    },
                },
            ],
        });
        canonical.title = '일반 이슈에서 변경';
        expect((await database.read(teamId, userId, sourceId)).rows[0].title).toBe(canonical.title);
        issues.find.mockReturnValueOnce(query([canonical, { ...canonical, _id: otherId }]));
        expect((await database.read(teamId, userId, sourceId)).rows).toHaveLength(2);
        expect(documents.findById).not.toHaveBeenCalled();
        expect(issues.create).not.toHaveBeenCalled();
    });

    it('updates canonical fields atomically and rejects stale writes including missing legacy revisions', async () => {
        expect(
            await database.updateCells(
                teamId,
                userId,
                sourceId,
                issueId,
                {
                    title: '수정',
                    status: '진행 중',
                    owner: [userId],
                    priority: '긴급',
                    labels: ['new'],
                    description: '설명',
                },
                0,
            ),
        ).toEqual({ revision: 1 });
        expect(canonical).toMatchObject({
            title: '수정',
            status: 'in_progress',
            priority: 'urgent',
            assigneeIds: [userId],
            revision: 1,
        });
        expect(canonical.links).toHaveLength(1);
        expect(events.emit).toHaveBeenCalledWith(
            NOTIFICATION_EVENTS.ISSUE_ASSIGNED,
            expect.objectContaining({ recipientIds: [userId], issueId }),
        );
        expect(events.emit).toHaveBeenCalledWith(CONTENT_CHANGED, { teamId, sourceId, resourceKind: 'issue' });
        await expect(
            database.updateCell(teamId, userId, sourceId, issueId, 'status', '완료', 0),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(canonical.status).toBe('in_progress');
        await database.updateCell(teamId, userId, sourceId, issueId, 'status', '완료', 1);
        expect(canonical.status).toBe('done');
    });

    it('enforces membership, write permissions, assignee membership, types and immutable fields', async () => {
        access.requireWritableMember.mockRejectedValueOnce(new ForbiddenException());
        await expect(
            database.updateCell(teamId, userId, sourceId, issueId, 'status', '완료', 0),
        ).rejects.toBeInstanceOf(ForbiddenException);
        const invalidValues: Array<Record<string, PropertyValue>> = [
            { owner: ['outsider'] },
            { status: 'done' },
            { priority: 'high' },
            { created_time: 'x' },
            { title: '' },
            { labels: [1] },
            { arbitrary: 'x' },
        ];
        for (const values of invalidValues) {
            await expect(service.update(teamId, userId, issueId, values, 0)).rejects.toBeInstanceOf(
                BadRequestException,
            );
        }
        await expect(service.update(otherId, userId, issueId, { title: 'wrong team' }, 0)).rejects.toBeInstanceOf(
            NotFoundException,
        );
        await expect(database.read(otherId, userId, sourceId)).rejects.toBeInstanceOf(NotFoundException);
        access.requireMember.mockResolvedValue({ role: 'guest' });
        expect((await database.read(teamId, userId, sourceId)).rows[0].canEdit).toBe(false);
        access.requireMember.mockRejectedValueOnce(new ForbiddenException());
        await expect(database.read(teamId, userId, sourceId)).rejects.toBeInstanceOf(ForbiddenException);
        expect(issues.updateOne).not.toHaveBeenCalled();
    });

    it('creates one canonical issue for retries, retains original creation identity after edits and rejects collisions', async () => {
        const values = { status: '리뷰 중', owner: ['member'] };
        await database.createRowPage(teamId, userId, sourceId, '새 이슈', issueId, values);
        expect(canonical).toMatchObject({ _id: issueId, status: 'in_review', sourceCreationId: issueId });
        issues.findById.mockImplementation(() => query(canonical));
        canonical.title = 'later edit';
        expect(await database.createRowPage(teamId, userId, sourceId, '새 이슈', issueId, values)).toEqual({
            documentId: issueId,
        });
        expect(issues.create).toHaveBeenCalledTimes(1);
        await expect(service.create(teamId, userId, 'different request', issueId, values)).rejects.toBeInstanceOf(
            ConflictException,
        );
        await expect(service.create(otherId, userId, '새 이슈', issueId, values)).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('supports standard query pagination and writable saved views despite fixed schema', async () => {
        expect(await database.query(teamId, userId, sourceId, { search: '없는 제목' })).toMatchObject({
            total: 0,
            rows: [],
        });
        expect(await database.query(teamId, userId, sourceId, { search: '채팅', limit: 1 })).toMatchObject({
            total: 1,
            nextOffset: null,
        });
        const view = await database.addView(teamId, userId, sourceId, {
            name: '상태 보드',
            layout: 'board',
            groupProperty: 'status',
            query: '',
            status: '',
            owner: '',
            sort: 'manual',
            revision: 0,
        });
        expect(view).toMatchObject({ name: '상태 보드', groupProperty: 'status' });
        expect(sources.updateOne).toHaveBeenCalledWith(
            { _id: sourceId, teamId, revision: 0 },
            expect.objectContaining({ $inc: { revision: 1 } }),
        );
    });

    it('rejects incoming document relations targeting the issue source', async () => {
        sources.findOne.mockImplementation(({ _id }) =>
            query(_id === otherId ? { ...source, _id: otherId, sourceKind: undefined, properties: [] } : source),
        );
        await expect(
            database.addProperty(teamId, userId, otherId, {
                name: 'issues',
                type: 'relation',
                targetDatabaseId: sourceId,
                revision: 0,
            }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(sources.updateOne).not.toHaveBeenCalled();
    });

    it.each([
        'addProperty',
        'configureProperty',
        'addRow',
        'mention',
        'renameProperty',
        'archiveProperty',
        'setLock',
        'createTemplate',
        'applyTemplate',
        'renameDatabase',
        'duplicateRow',
        'setDefaultTemplate',
        'removeTemplate',
    ])('rejects unsafe source operation %s before touching documents', async (method) => {
        await expect((database as any)[method](teamId, userId, sourceId, 'ignored', {}, 0)).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        expect(documents.findById).not.toHaveBeenCalled();
    });
});
