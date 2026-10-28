import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { isMongoId } from 'class-validator';
import { createHash } from 'node:crypto';
import { Issue } from '../issue/infrastructure/persistence/issue.schema';
import { issueSourceId, ISSUE_PRIORITY_LABELS, ISSUE_STATUS_LABELS } from '../issue/domain/issue-source';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { TEAM_REPOSITORY, type ITeamRepository } from '../team/domain/team.port';
import { CONTENT_CHANGED } from '../../shared/interceptors/content-change.interceptor';
import { NOTIFICATION_EVENTS } from '../../shared/events/notification-events';
import { KnowledgeDatabase, type DatabaseProperty, type PropertyValue } from './database.schema';

export const ISSUE_PROPERTIES: DatabaseProperty[] = [
    { id: 'status', name: '상태', type: 'status', options: Object.values(ISSUE_STATUS_LABELS) },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'priority', name: '우선순위', type: 'select', options: Object.values(ISSUE_PRIORITY_LABELS) },
    { id: 'labels', name: '라벨', type: 'multi_select', options: [] },
    { id: 'description', name: '설명', type: 'text' },
    { id: 'created_time', name: '생성일', type: 'created_time' },
    { id: 'last_edited_time', name: '수정일', type: 'last_edited_time' },
];

@Injectable()
export class IssueSourceService {
    constructor(
        @InjectModel(Issue.name) private readonly issues: Model<Issue>,
        @InjectModel(KnowledgeDatabase.name) private readonly databases: Model<KnowledgeDatabase>,
        private readonly access: TeamAccessService,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        private readonly events: EventEmitter2,
    ) {}

    async provision(teamId: string, userId: string) {
        await this.access.requireWritableMember(teamId, userId);
        const id = issueSourceId(teamId);
        try {
            await this.databases.updateOne(
                { _id: id, teamId, sourceKind: 'issues' },
                {
                    $setOnInsert: {
                        name: '워크스페이스 이슈',
                        sourceKind: 'issues',
                        properties: ISSUE_PROPERTIES,
                        createdBy: userId,
                        revision: 0,
                        views: [],
                        templates: [],
                    },
                },
                { upsert: true },
            );
        } catch (error) {
            if ((error as { code?: number }).code !== 11000) throw error;
        }
        const source = await this.databases.findOne({ _id: id, teamId, sourceKind: 'issues' }).lean();
        if (!source) throw new ConflictException('이슈 소스 식별자가 이미 사용 중입니다.');
        return {
            id,
            name: source.name,
            sourceKind: 'issues' as const,
            properties: source.properties,
            revision: source.revision,
        };
    }

    async read(teamId: string, userId: string, db: KnowledgeDatabase & { _id: unknown }, onlyId?: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        if (onlyId && !isMongoId(onlyId)) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        const issues = await this.issues
            .find({ teamId, ...(onlyId ? { _id: onlyId } : {}) })
            .sort({ createdAt: 1, _id: 1 })
            .lean();
        if (onlyId && !issues.length) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        const team = await this.teams.findById(teamId);
        const availablePersonIds = team!.members.map((member) => member.userId);
        const id = String(db._id);
        return {
            id,
            name: db.name,
            sourceKind: 'issues' as const,
            locked: false,
            canEditSchema: false,
            properties: ISSUE_PROPERTIES.map((p) =>
                p.id === 'labels'
                    ? { ...p, options: [...new Set(issues.flatMap((issue) => issue.labels ?? []))].sort() }
                    : p,
            ),
            archivedProperties: [] as DatabaseProperty[],
            defaultTemplateId: undefined,
            templates: [] as Array<{ id: string; name: string; documentId: string }>,
            views: db.views?.length
                ? db.views
                : [
                      {
                          id: 'default',
                          name: '표',
                          layout: 'table' as const,
                          query: '',
                          status: '',
                          owner: '',
                          sort: 'manual' as const,
                          dataSourceId: id,
                      },
                  ],
            revision: db.revision,
            rows: issues.map((issue) => ({
                documentId: String(issue._id),
                title: issue.title,
                canEdit: role !== 'guest',
                availablePersonIds,
                resourceKind: 'issue' as const,
                revision: issue.revision ?? 0,
                values: {
                    status: ISSUE_STATUS_LABELS[issue.status as keyof typeof ISSUE_STATUS_LABELS],
                    owner: issue.assigneeIds ?? [],
                    priority: ISSUE_PRIORITY_LABELS[issue.priority as keyof typeof ISSUE_PRIORITY_LABELS],
                    labels: issue.labels ?? [],
                    description: issue.description ?? '',
                    created_time: issue.createdAt?.toISOString() ?? null,
                    last_edited_time: issue.updatedAt?.toISOString() ?? null,
                } as Record<string, PropertyValue>,
                relations: {} as Record<string, Array<{ id: string; title: string }>>,
                formulaErrors: {} as Record<string, string>,
                relationRevisions: {} as Record<string, string>,
            })),
        };
    }

    private async patch(teamId: string, values: Record<string, PropertyValue>) {
        if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length > 50)
            throw new BadRequestException('올바른 이슈 속성을 지정하세요.');
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(values)) {
            if (key === 'status' || key === 'priority') {
                const options = key === 'status' ? ISSUE_STATUS_LABELS : ISSUE_PRIORITY_LABELS;
                const entry = Object.entries(options).find(([, label]) => label === value);
                if (!entry) throw new BadRequestException('지원하지 않는 선택 값입니다.');
                patch[key] = entry[0];
            } else if (key === 'owner' || key === 'labels') {
                if (
                    !Array.isArray(value) ||
                    value.length > 100 ||
                    value.some((v) => typeof v !== 'string' || !v.trim() || v.length > 200)
                )
                    throw new BadRequestException('문자열 목록을 지정하세요.');
                if (key === 'owner') {
                    const team = await this.teams.findById(teamId);
                    if (value.some((id) => !team?.getMember(id as string)))
                        throw new BadRequestException('워크스페이스 멤버만 담당자로 지정할 수 있습니다.');
                }
                patch[key === 'owner' ? 'assigneeIds' : key] = [...new Set(value)];
            } else if (key === 'title' || key === 'description') {
                if (typeof value !== 'string' || (key === 'title' && !value.trim()) || value.length > 100000)
                    throw new BadRequestException('올바른 텍스트를 지정하세요.');
                patch[key] = key === 'title' ? value.trim() : value;
            } else throw new BadRequestException('이슈 소스의 읽기 전용 또는 알 수 없는 속성입니다.');
        }
        return patch;
    }

    private changed(teamId: string) {
        this.events.emit(CONTENT_CHANGED, { teamId, sourceId: issueSourceId(teamId), resourceKind: 'issue' });
    }
    private assigned(teamId: string, actorId: string, issueId: string, issueTitle: string, recipientIds: string[]) {
        if (recipientIds.length)
            this.events.emit(NOTIFICATION_EVENTS.ISSUE_ASSIGNED, {
                teamId,
                actorId,
                issueId,
                issueTitle,
                recipientIds,
            });
    }

    async update(
        teamId: string,
        userId: string,
        issueId: string,
        values: Record<string, PropertyValue>,
        revision: number,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        if (!isMongoId(issueId)) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        const patch = await this.patch(teamId, values);
        if (!Object.keys(patch).length || !Number.isInteger(revision) || revision < 0)
            throw new BadRequestException('속성과 revision을 지정하세요.');
        const before = await this.issues.findOne({ _id: issueId, teamId }).lean();
        if (!before) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        // Existing canonical issues have no revision until their first write.
        const version = revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision };
        const result = await this.issues.updateOne(
            { _id: issueId, teamId, ...version },
            { $set: patch, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.');
        this.assigned(
            teamId,
            userId,
            issueId,
            (patch.title as string) ?? before.title,
            ((patch.assigneeIds as string[]) ?? []).filter((id) => !(before.assigneeIds ?? []).includes(id)),
        );
        this.changed(teamId);
        return { revision: revision + 1 };
    }

    async create(
        teamId: string,
        userId: string,
        title: string,
        creationId: string,
        values: Record<string, PropertyValue>,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        if (!isMongoId(creationId) || typeof title !== 'string' || !title.trim())
            throw new BadRequestException('이슈 이름과 생성 식별자를 지정하세요.');
        const patch = { ...(await this.patch(teamId, values)), ...(await this.patch(teamId, { title })) };
        const creationHash = createHash('sha256')
            .update(JSON.stringify(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b))))
            .digest('hex');
        const existing = await this.issues.findById(creationId).lean();
        if (existing) {
            if (
                String(existing.teamId) !== teamId ||
                existing.createdBy !== userId ||
                existing.sourceCreationId !== creationId
            )
                throw new NotFoundException('생성 요청을 찾을 수 없습니다.');
            if (existing.sourceCreationHash !== creationHash)
                throw new ConflictException('같은 생성 요청에 다른 내용을 사용할 수 없습니다.');
            return { documentId: creationId };
        }
        try {
            await this.issues.create({
                _id: creationId,
                teamId,
                createdBy: userId,
                sourceCreationId: creationId,
                sourceCreationHash: creationHash,
                ...patch,
            });
        } catch (error) {
            if ((error as { code?: number }).code === 11000)
                return this.create(teamId, userId, title, creationId, values);
            throw error;
        }
        this.assigned(teamId, userId, creationId, patch.title as string, (patch.assigneeIds as string[]) ?? []);
        this.changed(teamId);
        return { documentId: creationId };
    }
}
