import { IssueSourceService } from './issue-source.service';
import { createHash } from 'node:crypto';
import { CreateDocumentUseCase } from '../document/application/use-cases/create-document.use-case';
import {
    aggregateValues,
    AGGREGATION_LABELS,
    NUMERIC_AGGREGATIONS,
    DATE_AGGREGATIONS,
    queryDatabaseRows,
    validateDatabaseQuery,
} from '@slacord/document-core';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type HydratedDocument } from 'mongoose';
import { isMongoId } from 'class-validator';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../document/domain/document.port';
import { TEAM_REPOSITORY, type ITeamRepository } from '../team/domain/team.port';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { DatabaseRow, KnowledgeDatabase, type DatabaseProperty, type PropertyValue } from './database.schema';
import { AddPropertyDto, AddViewDto, RenamePropertyDto, DatabaseQueryDto } from './database.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { parseFormula, evaluateFormula, type FormulaValue } from './formula';
import { NOTIFICATION_EVENTS } from '../../shared/events/notification-events';

@Injectable()
export class DatabaseService {
    constructor(
        @InjectModel(KnowledgeDatabase.name) private readonly databases: Model<KnowledgeDatabase>,
        @InjectModel(DatabaseRow.name) private readonly rows: Model<DatabaseRow>,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        private readonly access: TeamAccessService,
        private readonly events: EventEmitter2,
        private readonly createDocument: CreateDocumentUseCase,
        private readonly issueSource: IssueSourceService,
    ) {}

    provisionIssueSource(teamId: string, userId: string) {
        return this.issueSource.provision(teamId, userId);
    }
    private assertDocumentSource(db: KnowledgeDatabase) {
        if (db.sourceKind === 'issues')
            throw new ForbiddenException('Issue sources have a fixed schema and do not support document operations.');
    }
    async database(teamId: string, id: string, userId: string, write = false) {
        if (write) await this.access.requireWritableMember(teamId, userId);
        else await this.access.requireMember(teamId, userId);
        if (!isMongoId(id)) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
        const db = await this.databases.findOne({ _id: id, teamId }).lean();
        if (!db) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
        if (db.parentDocumentId) await this.assertPage(teamId, userId, db.parentDocumentId, write);
        return db;
    }
    async assertPage(teamId: string, userId: string, documentId: string, write = false) {
        const { role } = await this.access.requireMember(teamId, userId);
        const doc = await this.documents.findById(documentId);
        if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
            throw new NotFoundException('상위 페이지를 찾을 수 없습니다.');
        if (write && !doc.canEdit(userId, role)) throw new ForbiddenException('상위 페이지를 편집할 권한이 없습니다.');
        return doc;
    }
    private async visibleDocuments(teamId: string, userId: string, role: string) {
        return new Map(
            (await this.documents.findMetadataByTeam(teamId))
                .filter((doc) => !doc.isArchived && doc.canView(userId, role))
                .map((doc) => [doc.id, doc]),
        );
    }
    private inverseProperties(
        id: string,
        sources: Array<{ _id: unknown; properties: DatabaseProperty[] }>,
    ): DatabaseProperty[] {
        return sources.flatMap((source) =>
            source.properties
                .filter(
                    (prop) =>
                        !prop.archived && prop.type === 'relation' && prop.targetDatabaseId === id && prop.inverse,
                )
                .map((prop) => ({
                    id: prop.inverse!.id,
                    name: prop.inverse!.name,
                    type: 'relation' as const,
                    targetDatabaseId: String(source._id),
                    cardinality: 'many' as const,
                    reverseOf: { databaseId: String(source._id), propertyId: prop.id },
                })),
        );
    }
    private relationVersion(rows: Array<{ documentId: string; revision: number }>) {
        return createHash('sha256')
            .update(
                rows
                    .map((row) => `${row.documentId}:${row.revision}`)
                    .sort()
                    .join('|'),
            )
            .digest('hex');
    }
    async list(teamId: string, userId: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        const visible = await this.visibleDocuments(teamId, userId, role);
        const sources = (await this.databases.find({ teamId }).sort({ createdAt: 1 }).lean()).filter(
            (db) => !db.parentDocumentId || visible.has(db.parentDocumentId),
        );
        return sources.map((db) => ({
            id: String(db._id),
            name: db.name,
            sourceKind: db.sourceKind,
            parentDocumentId: db.parentDocumentId ?? null,
            locked: db.locked ?? false,
            properties: [
                ...db.properties.filter((prop) => !prop.archived),
                ...this.inverseProperties(String(db._id), sources),
            ],
            revision: db.revision,
        }));
    }
    private async completeProperties(teamId: string, userId: string, id: string) {
        return (await this.list(teamId, userId)).find((db) => db.id === id)?.properties ?? [];
    }
    async create(
        teamId: string,
        userId: string,
        name: string,
        creationId?: string,
        parentDocumentId?: string,
        blank = false,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        if (!name.trim()) throw new BadRequestException('이름을 입력하세요.');
        if (parentDocumentId) await this.assertPage(teamId, userId, parentDocumentId, true);
        if (creationId) {
            const existing = await this.databases.findById(creationId).lean();
            if (existing) {
                if (existing.teamId !== teamId || existing.createdBy !== userId)
                    throw new NotFoundException('데이터 소스를 찾을 수 없습니다.');
                if (existing.parentDocumentId) await this.assertPage(teamId, userId, existing.parentDocumentId, true);
                if (existing.name !== name.trim())
                    throw new ConflictException('같은 생성 요청에 다른 이름을 사용할 수 없습니다.');
                return {
                    id: String(existing._id),
                    name: existing.name,
                    locked: existing.locked ?? false,
                    properties: existing.properties.filter((prop) => !prop.archived),
                    revision: existing.revision,
                };
            }
        }

        let db: HydratedDocument<KnowledgeDatabase>;
        try {
            db = await this.databases.create({
                ...(creationId ? { _id: creationId } : {}),
                parentDocumentId,
                teamId,
                name: name.trim(),
                createdBy: userId,
                properties: blank
                    ? []
                    : [
                          { id: 'owner', name: '담당자', type: 'person' },
                          {
                              id: 'status',
                              name: '상태',
                              type: 'status',
                              options: ['초안', '검토 중', '게시됨', '보관'],
                          },
                          { id: 'reviewDate', name: '검토일', type: 'date' },
                      ],
            });
        } catch (error) {
            if ((error as { code?: number }).code === 11000 && creationId)
                return this.create(teamId, userId, name, creationId, parentDocumentId, blank);
            throw error;
        }
        return {
            id: String(db._id),
            name: db.name,
            sourceKind: db.sourceKind,
            locked: db.locked ?? false,
            properties: db.properties.filter((prop) => !prop.archived),
            revision: db.revision,
        };
    }
    async addProperty(teamId: string, userId: string, id: string, dto: AddPropertyDto) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제한 후 구조를 변경하세요.');
        if (!dto.name.trim() || db.properties.length >= 500)
            throw new BadRequestException('속성 이름과 개수(최대 500개)를 확인하세요.');
        const property = await this.buildProperty(
            teamId,
            userId,
            await this.completeProperties(teamId, userId, id),
            dto,
        );
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision: dto.revision },
            { $push: { properties: property }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('속성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
        if (property.type === 'unique_id') await this.ensureRowNumbers(teamId, id);
        return property;
    }
    private async buildProperty(
        teamId: string,
        userId: string,
        properties: DatabaseProperty[],
        dto: AddPropertyDto,
        references: Array<{ name: string; id: string }> = [],
    ) {
        const property: DatabaseProperty = {
            id: new Types.ObjectId().toHexString(),
            name: dto.name.trim(),
            type: dto.type,
        };
        if (['select', 'multi_select', 'status'].includes(dto.type)) {
            if (!dto.options?.length || dto.options.some((item) => !item.trim()))
                throw new BadRequestException('선택 항목을 입력하세요.');
            property.options = [...new Set(dto.options.map((option) => option.trim()))];
        }
        if (dto.type === 'unique_id') property.prefix = dto.prefix?.trim() ?? 'ID';
        if (dto.type === 'formula') {
            try {
                const parsed = parseFormula(dto.formula ?? '');
                property.formula = dto.formula;
                property.formulaReferences = parsed.references.map((name) => {
                    if (name === '이름' || name === 'Name' || name === 'title') return { name, id: 'title' };
                    const bound = references.find((ref) => ref.name === name);
                    const target = properties.find(
                        (p) => !p.archived && (bound ? p.id === bound.id : p.name === name || p.id === name),
                    );
                    if (!target) throw new Error(`속성을 찾을 수 없습니다: ${name}`);
                    return { name, id: target.id };
                });
            } catch (error) {
                throw new BadRequestException((error as Error).message);
            }
        }
        if (dto.type === 'relation') {
            this.assertDocumentSource(await this.database(teamId, dto.targetDatabaseId ?? '', userId));
            property.targetDatabaseId = dto.targetDatabaseId;
            property.cardinality = dto.cardinality ?? 'many';
            if (dto.bidirectional) {
                const target = await this.database(teamId, dto.targetDatabaseId!, userId, true);
                if (target.locked) throw new ForbiddenException('대상 데이터베이스 잠금을 해제하세요.');
                property.inverse = { id: `inverse_${property.id}`, name: dto.inverseName?.trim() || '연결된 항목' };
            }
        }
        if (dto.type === 'rollup') {
            const relation = properties.find(
                (item) => !item.archived && item.id === dto.relationPropertyId && item.type === 'relation',
            );
            if (!relation || !dto.aggregation) throw new BadRequestException('관계형 속성과 집계 방식을 선택하세요.');
            const target = await this.database(teamId, relation.targetDatabaseId!, userId);
            target.properties = await this.completeProperties(teamId, userId, relation.targetDatabaseId!);
            const targetProperty = target.properties.find((item) => !item.archived && item.id === dto.targetPropertyId);
            if (
                dto.aggregation !== 'count' &&
                (!targetProperty ||
                    ['formula', 'rollup'].includes(targetProperty.type) ||
                    !!targetProperty.reverseOf ||
                    (NUMERIC_AGGREGATIONS.includes(dto.aggregation) && targetProperty.type !== 'number') ||
                    (DATE_AGGREGATIONS.includes(dto.aggregation) &&
                        !['date', 'created_time', 'last_edited_time'].includes(targetProperty.type)))
            )
                throw new BadRequestException('집계할 속성과 계산 방식의 유형을 확인하세요.');
            Object.assign(property, {
                relationPropertyId: relation.id,
                targetPropertyId: dto.targetPropertyId,
                aggregation: dto.aggregation,
            });
        }
        return property;
    }
    async configureProperty(teamId: string, userId: string, id: string, propertyId: string, dto: AddPropertyDto) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제한 후 구조를 변경하세요.');
        const current = db.properties.find((prop) => prop.id === propertyId && !prop.archived);
        if (!current) throw new NotFoundException('속성을 찾을 수 없습니다.');
        if (current.type !== dto.type) throw new BadRequestException('속성 유형 변환은 별도 데이터 변환이 필요합니다.');
        if (!dto.name.trim()) throw new BadRequestException('속성 이름을 입력하세요.');
        const updated = {
            ...(await this.buildProperty(
                teamId,
                userId,
                await this.completeProperties(teamId, userId, id),
                dto,
                current.formulaReferences,
            )),
            id: propertyId,
        };
        if (current.type === 'relation' && current.targetDatabaseId !== updated.targetDatabaseId)
            throw new BadRequestException('기존 관계의 데이터 소스는 변경할 수 없습니다. 새 관계 속성을 추가하세요.');
        if (current.inverse && updated.inverse) updated.inverse.id = current.inverse.id;
        const rows = await this.rows.find({ teamId, databaseId: id }).select('values').lean();
        if (updated.options) {
            const allowed = new Set(updated.options);
            if (
                rows.some((row) => {
                    const value = row.values[propertyId];
                    return (Array.isArray(value) ? value : value == null ? [] : [value]).some(
                        (item) => !allowed.has(String(item)),
                    );
                })
            )
                throw new BadRequestException('사용 중인 선택 항목은 먼저 다른 값으로 변경한 후 삭제하세요.');
        }
        if (
            updated.type === 'relation' &&
            updated.cardinality === 'one' &&
            rows.some(
                (row) => Array.isArray(row.values[propertyId]) && (row.values[propertyId] as unknown[]).length > 1,
            )
        )
            throw new BadRequestException('여러 페이지가 연결된 항목이 있습니다. 연결을 정리한 후 제한을 변경하세요.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision: dto.revision, 'properties.id': propertyId },
            { $set: { 'properties.$': updated }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('속성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return updated;
    }
    async addRow(
        teamId: string,
        userId: string,
        id: string,
        documentId: string,
        defaults: Record<string, PropertyValue> = {},
    ) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        const doc = await this.documents.findById(documentId);
        if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
            throw new NotFoundException('문서를 찾을 수 없습니다.');
        if (!doc.canEdit(userId, role)) throw new ForbiddenException('이 문서를 편집할 권한이 없습니다.');
        if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults) || Object.keys(defaults).length > 50)
            throw new BadRequestException('초기 속성을 확인하세요.');
        const prepared = await Promise.all(
            Object.entries(defaults).map(([propertyId, value]) =>
                this.prepareCell(teamId, userId, id, documentId, propertyId, value),
            ),
        );
        const values = Object.fromEntries(prepared.map((item) => [item.prop.id, item.value]));
        try {
            const result = await this.rows.updateOne(
                { teamId, databaseId: id, documentId },
                { $setOnInsert: { values, revision: 0, updatedBy: userId } },
                { upsert: true },
            );
            if (result.upsertedCount)
                for (const { prop, value } of prepared) {
                    if (prop.type === 'person' && Array.isArray(value))
                        this.events.emit(NOTIFICATION_EVENTS.DOCUMENT_ASSIGNED, {
                            teamId,
                            actorId: userId,
                            documentId,
                            recipientIds: value,
                        });
                }
        } catch (error) {
            if ((error as { code?: number }).code !== 11000) throw error;
        }
        if ((await this.database(teamId, id, userId, true)).properties.some((prop) => prop.type === 'unique_id'))
            await this.ensureRowNumbers(teamId, id);
        return { documentId };
    }
    async read(teamId: string, userId: string, id: string, onlyDocumentId?: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        const db = await this.database(teamId, id, userId);
        if (db.sourceKind === 'issues') return this.issueSource.read(teamId, userId, db, onlyDocumentId);
        const [visible, team] = await Promise.all([
            this.visibleDocuments(teamId, userId, role),
            this.teams.findById(teamId),
        ]);
        const storedProperties = db.properties;
        db.properties = [
            ...storedProperties,
            ...(await this.completeProperties(teamId, userId, id)).filter((prop) => prop.reverseOf),
        ];
        if (db.properties.some((prop) => prop.type === 'unique_id')) await this.ensureRowNumbers(teamId, id);
        if (onlyDocumentId && !visible.has(onlyDocumentId)) throw new NotFoundException('문서를 찾을 수 없습니다.');
        const rows = await this.rows
            .find({
                teamId,
                databaseId: id,
                ...(onlyDocumentId ? {} : { isTemplate: { $ne: true } }),
                documentId: onlyDocumentId ?? { $in: [...visible.keys()] },
            })
            .sort({ _id: 1 })
            .lean();
        const reverseRows = new Map<
            string,
            Array<{ documentId: string; revision: number; values: Record<string, PropertyValue> }>
        >();
        await Promise.all(
            db.properties
                .filter((prop) => prop.reverseOf)
                .map(async (prop) => {
                    const origin = prop.reverseOf!;
                    const incoming = await this.rows
                        .find({
                            teamId,
                            databaseId: origin.databaseId,
                            isTemplate: { $ne: true },
                            documentId: { $in: [...visible.keys()] },
                            [`values.${origin.propertyId}`]: { $in: rows.map((row) => row.documentId) },
                        })
                        .lean();
                    reverseRows.set(prop.id, incoming);
                    for (const row of rows)
                        row.values[prop.id] = incoming
                            .filter(
                                (item) =>
                                    Array.isArray(item.values[origin.propertyId]) &&
                                    (item.values[origin.propertyId] as string[]).includes(row.documentId),
                            )
                            .map((item) => item.documentId);
                }),
        );
        const relationIds = new Set<string>();
        for (const row of rows)
            for (const prop of db.properties.filter((p) => !p.archived && p.type === 'relation')) {
                for (const target of (row.values[prop.id] as string[]) ?? [])
                    if (visible.has(target)) relationIds.add(target);
            }
        const related = await this.rows.find({ teamId, documentId: { $in: [...relationIds] } }).lean();
        const targetSchemas = await this.databases
            .find({
                teamId,
                _id: {
                    $in: db.properties
                        .filter((p) => !p.archived && p.type === 'relation')
                        .map((p) => p.targetDatabaseId),
                },
            })
            .lean();
        const schemasById = new Map(
            targetSchemas
                .filter((schema) => !schema.parentDocumentId || visible.has(schema.parentDocumentId))
                .map((schema) => [String(schema._id), schema]),
        );
        const relatedMap = new Map(
            related
                .filter((row) => schemasById.has(row.databaseId))
                .map((row) => [`${row.databaseId}:${row.documentId}`, row]),
        );
        return {
            id,
            name: db.name,
            sourceKind: db.sourceKind,
            locked: db.locked ?? false,
            properties: db.properties.filter((prop) => !prop.archived),
            canEditSchema:
                role !== 'guest' && (!db.parentDocumentId || !!visible.get(db.parentDocumentId)?.canEdit(userId, role)),
            archivedProperties: db.properties.filter((prop) => prop.archived),
            defaultTemplateId: (db.templates ?? []).some(
                (template) => template.id === db.defaultTemplateId && visible.has(template.documentId),
            )
                ? db.defaultTemplateId
                : undefined,
            templates: (db.templates ?? [])
                .filter((template) => visible.has(template.documentId))
                .map((template) => ({ ...template, name: visible.get(template.documentId)!.title })),
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
            rows: rows.map((row) => {
                const values = Object.fromEntries(
                    Object.entries(row.values).filter(([key]) =>
                        db.properties.some((prop) => prop.id === key && !prop.archived),
                    ),
                );
                const formulaErrors: Record<string, string> = {};
                const relations: Record<string, Array<{ id: string; title: string }>> = {};
                for (const prop of db.properties.filter((p) => !p.archived && p.type === 'relation')) {
                    const ids = ((values[prop.id] ?? []) as string[]).filter(
                        (target) => visible.has(target) && relatedMap.has(`${prop.targetDatabaseId}:${target}`),
                    );
                    values[prop.id] = ids;
                    relations[prop.id] = ids.map((target) => ({ id: target, title: visible.get(target)!.title }));
                }
                for (const prop of db.properties.filter((p) => !p.archived && p.type === 'rollup')) {
                    const relation = db.properties.find((p) => !p.archived && p.id === prop.relationPropertyId);
                    const targetDefinition = schemasById
                        .get(relation?.targetDatabaseId ?? '')
                        ?.properties.find((p) => !p.archived && p.id === prop.targetPropertyId);
                    if (!relation || (prop.aggregation !== 'count' && !targetDefinition)) {
                        values[prop.id] = null;
                        formulaErrors[prop.id] = '집계에 필요한 속성이 삭제되었습니다.';
                        continue;
                    }
                    const ids = (values[relation?.id ?? ''] ?? []) as string[];
                    const targets = ids.map((target) => {
                        const relatedRow = relatedMap.get(`${relation?.targetDatabaseId}:${target}`);
                        const targetProperty = schemasById
                            .get(relation?.targetDatabaseId ?? '')
                            ?.properties.find((p) => p.id === prop.targetPropertyId);
                        const targetDoc = visible.get(target)!;
                        if (targetProperty?.type === 'unique_id')
                            return relatedRow?.sequence == null
                                ? null
                                : `${targetProperty.prefix ? targetProperty.prefix + '-' : ''}${relatedRow.sequence}`;
                        if (targetProperty?.type === 'created_time') return targetDoc.createdAt.toISOString();
                        if (targetProperty?.type === 'created_by') return [targetDoc.createdBy];
                        const editedAt = relatedRow?.updatedAt ? new Date(relatedRow.updatedAt) : targetDoc.updatedAt;
                        if (targetProperty?.type === 'last_edited_time')
                            return (editedAt > targetDoc.updatedAt ? editedAt : targetDoc.updatedAt).toISOString();
                        if (targetProperty?.type === 'last_edited_by')
                            return [
                                editedAt > targetDoc.updatedAt
                                    ? (relatedRow?.updatedBy ?? targetDoc.updatedBy)
                                    : targetDoc.updatedBy,
                            ];
                        const result = relatedRow?.values[prop.targetPropertyId ?? ''];
                        if (targetProperty?.type === 'relation' && Array.isArray(result))
                            return result.filter((id) => typeof id === 'string' && visible.has(id));
                        return result;
                    });
                    values[prop.id] = aggregateValues(targets, prop.aggregation ?? 'count');
                }
                const doc = visible.get(row.documentId)!;
                const rowEdited = row.updatedAt ? new Date(row.updatedAt) : doc.updatedAt;
                const lastEdit = rowEdited > doc.updatedAt ? rowEdited : doc.updatedAt;
                const lastEditor = rowEdited > doc.updatedAt ? (row.updatedBy ?? doc.updatedBy) : doc.updatedBy;
                for (const prop of db.properties.filter((prop) => !prop.archived)) {
                    if (prop.type === 'unique_id')
                        values[prop.id] =
                            row.sequence == null ? null : `${prop.prefix ? prop.prefix + '-' : ''}${row.sequence}`;
                    if (prop.type === 'created_time') values[prop.id] = doc.createdAt.toISOString();
                    if (prop.type === 'last_edited_time') values[prop.id] = lastEdit.toISOString();
                    if (prop.type === 'created_by') values[prop.id] = [doc.createdBy];
                    if (prop.type === 'last_edited_by') values[prop.id] = [lastEditor];
                }
                const calculated = new Map<string, FormulaValue>();
                const visiting = new Set<string>();
                const resolve = (propertyId: string): FormulaValue => {
                    if (propertyId === 'title') return doc.title;
                    if (calculated.has(propertyId)) return calculated.get(propertyId)!;
                    const prop = db.properties.find((p) => p.id === propertyId);
                    if (!prop || prop.archived) throw new Error('참조한 속성이 삭제되었습니다.');
                    if (formulaErrors[propertyId]) throw new Error(formulaErrors[propertyId]);
                    if (prop.type !== 'formula') return values[propertyId] ?? null;
                    if (visiting.has(propertyId) || visiting.size >= 15)
                        throw new Error('수식 순환 참조 또는 참조 깊이 초과입니다.');
                    visiting.add(propertyId);
                    try {
                        const parsed = parseFormula(prop.formula ?? '');
                        const value = evaluateFormula(parsed.node, (name) => {
                            const target = prop.formulaReferences?.find((ref) => ref.name === name)?.id;
                            if (!target) throw new Error(`참조한 속성을 찾을 수 없습니다: ${name}`);
                            return resolve(target);
                        });
                        calculated.set(propertyId, value);
                        return value;
                    } finally {
                        visiting.delete(propertyId);
                    }
                };
                for (const prop of db.properties.filter((p) => !p.archived && p.type === 'formula')) {
                    try {
                        const result = resolve(prop.id);
                        values[prop.id] = Array.isArray(result)
                            ? result.map((v) => (Array.isArray(v) ? JSON.stringify(v) : v))
                            : result;
                    } catch (error) {
                        values[prop.id] = null;
                        formulaErrors[prop.id] = (error as Error).message;
                    }
                }
                return {
                    documentId: row.documentId,
                    title: doc.title,
                    canEdit:
                        role !== 'guest' &&
                        doc.canEdit(userId, role) &&
                        (!db.parentDocumentId || !!visible.get(db.parentDocumentId)?.canEdit(userId, role)),
                    availablePersonIds: team!.members
                        .filter(
                            (member) =>
                                doc.canView(member.userId, member.role) &&
                                (!db.parentDocumentId ||
                                    !!visible.get(db.parentDocumentId)?.canView(member.userId, member.role)),
                        )
                        .map((member) => member.userId),
                    values,
                    relations,
                    formulaErrors,
                    relationRevisions: Object.fromEntries(
                        db.properties
                            .filter((prop) => prop.reverseOf)
                            .map((prop) => [
                                prop.id,
                                this.relationVersion(
                                    (reverseRows.get(prop.id) ?? []).filter((item) =>
                                        (item.values[prop.reverseOf!.propertyId] as string[]).includes(row.documentId),
                                    ),
                                ),
                            ]),
                    ),
                    revision: row.revision,
                };
            }),
        };
    }
    private async prepareCell(
        teamId: string,
        userId: string,
        id: string,
        documentId: string,
        propertyId: string,
        value: PropertyValue,
    ) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const [db, visible] = await Promise.all([
            this.database(teamId, id, userId, true),
            this.visibleDocuments(teamId, userId, role),
        ]);
        const doc = visible.get(documentId);
        if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
        if (!doc.canEdit(userId, role)) throw new ForbiddenException('이 문서를 편집할 권한이 없습니다.');
        const prop = db.properties.find((p) => p.id === propertyId);
        if (
            !prop ||
            prop.archived ||
            [
                'unique_id',
                'rollup',
                'formula',
                'created_time',
                'created_by',
                'last_edited_time',
                'last_edited_by',
            ].includes(prop.type)
        )
            throw new BadRequestException('편집할 수 없는 속성입니다.');
        const before = await this.rows.findOne({ teamId, databaseId: id, documentId }).lean();
        const relationSource =
            prop.type === 'relation'
                ? await this.databases.findOne({ _id: prop.targetDatabaseId, teamId }).lean()
                : null;
        const relationVisible =
            !!relationSource && (!relationSource.parentDocumentId || visible.has(relationSource.parentDocumentId));

        if (value !== null) {
            const type = prop.type;
            if (
                ['text', 'url', 'email', 'phone', 'date', 'select', 'status'].includes(type) &&
                (typeof value !== 'string' || value.length > 10000)
            )
                throw new BadRequestException('문자열 값을 입력하세요.');
            if (type === 'email' && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))
                throw new BadRequestException('이메일 주소를 확인하세요.');
            if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
                throw new BadRequestException('올바른 숫자를 입력하세요.');
            if (type === 'checkbox' && typeof value !== 'boolean')
                throw new BadRequestException('체크박스 값을 확인하세요.');
            if (
                type === 'date' &&
                (typeof value !== 'string' ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
                    !Number.isFinite(Date.parse(value)) ||
                    new Date(value).toISOString().slice(0, 10) !== value)
            )
                throw new BadRequestException('날짜를 확인하세요.');
            if (type === 'url' && (typeof value !== 'string' || !/^https?:\/\/\S+$/i.test(value)))
                throw new BadRequestException('http 또는 https 주소를 입력하세요.');
            if (['select', 'status'].includes(type) && !prop.options?.includes(value as string))
                throw new BadRequestException('선택 항목을 확인하세요.');
            if (['person', 'relation', 'multi_select'].includes(type)) {
                if (
                    !Array.isArray(value) ||
                    value.length > 100 ||
                    value.some((item) => typeof item !== 'string') ||
                    new Set(value).size !== value.length
                )
                    throw new BadRequestException('선택 목록을 확인하세요.');
                if (type === 'person') {
                    const team = await this.teams.findById(teamId);
                    if (
                        value.some((id) => {
                            const member = team?.getMember(String(id));
                            return (
                                !member ||
                                !doc.canView(String(id), member.role) ||
                                (!!db.parentDocumentId &&
                                    !visible.get(db.parentDocumentId)?.canView(String(id), member.role))
                            );
                        })
                    )
                        throw new BadRequestException(
                            '이 페이지에 접근할 수 있는 사람을 지정하세요. 먼저 페이지를 공유할 수 있습니다.',
                        );
                }
                if (type === 'multi_select' && value.some((item) => !prop.options?.includes(String(item))))
                    throw new BadRequestException('선택 항목을 확인하세요.');
                if (type === 'relation') {
                    if (value.length && !relationVisible)
                        throw new NotFoundException('연결할 데이터 소스를 찾을 수 없습니다.');
                    if (prop.cardinality === 'one' && value.length > 1)
                        throw new BadRequestException('이 관계는 한 페이지만 연결할 수 있습니다.');
                    const targets = await this.rows
                        .find({ teamId, databaseId: prop.targetDatabaseId, documentId: { $in: value as string[] } })
                        .lean();
                    if (targets.length !== value.length || value.some((target) => !visible.has(String(target))))
                        throw new NotFoundException('연결할 문서를 찾을 수 없습니다.');
                }
            }
        }
        // A viewer cannot accidentally remove relationships to rows hidden from them.
        if (prop.type === 'relation') {
            const hidden = ((before?.values[propertyId] ?? []) as string[]).filter(
                (target) => !relationVisible || !visible.has(String(target)),
            );
            value = [...new Set([...hidden, ...((value ?? []) as string[])])];
            if (prop.cardinality === 'one' && value.length > 1)
                throw new BadRequestException('기존 연결이 있어 새 페이지를 연결할 수 없습니다.');
        }
        return { prop, value, before };
    }
    async updateCell(
        teamId: string,
        userId: string,
        id: string,
        documentId: string,
        propertyId: string,
        value: PropertyValue,
        revision: number,
        relationRevision?: string,
    ) {
        if (propertyId.startsWith('inverse_'))
            return this.updateInverse(teamId, userId, id, documentId, propertyId, value, revision, relationRevision);
        return this.updateCells(teamId, userId, id, documentId, { [propertyId]: value }, revision);
    }
    private async updateInverse(
        teamId: string,
        userId: string,
        id: string,
        documentId: string,
        propertyId: string,
        value: PropertyValue,
        revision: number,
        relationRevision?: string,
    ) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        await this.database(teamId, id, userId, true);
        const detail = await this.read(teamId, userId, id, documentId);
        const property = detail.properties.find((prop) => prop.id === propertyId && prop.reverseOf);
        const row = detail.rows[0];
        if (!property?.reverseOf || !row) throw new NotFoundException('관계를 찾을 수 없습니다.');
        if (!row.canEdit) throw new ForbiddenException('이 페이지를 편집할 권한이 없습니다.');
        if (row.revision !== revision || !relationRevision || row.relationRevisions[propertyId] !== relationRevision)
            throw new ConflictException('관계가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        if (value === null) value = [];
        if (
            !Array.isArray(value) ||
            value.length > 100 ||
            value.some((item) => typeof item !== 'string') ||
            new Set(value).size !== value.length
        )
            throw new BadRequestException('관계 목록을 확인하세요.');
        const before = (row.values[propertyId] ?? []) as string[];
        const after = value as string[];
        const added = after.filter((item) => !before.includes(item)),
            removed = before.filter((item) => !after.includes(item));
        if (added.length + removed.length === 0) return { revision };
        if (added.length + removed.length !== 1)
            throw new BadRequestException('역방향 관계는 한 번에 한 페이지씩 변경하세요.');
        const source = property.reverseOf;
        const sourceDb = await this.database(teamId, source.databaseId, userId, true);
        const sourceProperty = sourceDb.properties.find(
            (prop) => prop.id === source.propertyId && !prop.archived && prop.inverse?.id === propertyId,
        );
        if (!sourceProperty) throw new NotFoundException('원본 관계를 찾을 수 없습니다.');
        const targetId = added[0] ?? removed[0];
        if (!isMongoId(targetId)) throw new BadRequestException('페이지 ID를 확인하세요.');
        const [origin, originDoc] = await Promise.all([
            this.rows
                .findOne({ teamId, databaseId: source.databaseId, documentId: targetId, isTemplate: { $ne: true } })
                .lean(),
            this.documents.findById(targetId),
        ]);
        if (
            !origin ||
            !originDoc ||
            originDoc.teamId !== teamId ||
            originDoc.isArchived ||
            !originDoc.canView(userId, role)
        )
            throw new NotFoundException('연결할 페이지를 찾을 수 없습니다.');
        if (!originDoc.canEdit(userId, role)) throw new ForbiddenException('원본 페이지를 편집할 권한이 필요합니다.');
        const values = (origin.values[source.propertyId] ?? []) as string[];
        const next = added.length
            ? [...new Set([...values, documentId])]
            : values.filter((item) => item !== documentId);
        if (sourceProperty.cardinality === 'one' && next.length > 1)
            throw new BadRequestException('원본 관계는 한 페이지만 연결할 수 있습니다.');
        const result = await this.rows.updateOne(
            { _id: origin._id, revision: origin.revision },
            { $set: { [`values.${source.propertyId}`]: next, updatedBy: userId }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('원본 페이지가 변경되었습니다. 다시 시도하세요.');
        return { revision };
    }
    async updateCells(
        teamId: string,
        userId: string,
        id: string,
        documentId: string,
        values: Record<string, PropertyValue>,
        revision: number,
    ) {
        const db = await this.database(teamId, id, userId, true);
        if (db.sourceKind === 'issues') return this.issueSource.update(teamId, userId, documentId, values, revision);
        if (
            !values ||
            typeof values !== 'object' ||
            Array.isArray(values) ||
            !Object.keys(values).length ||
            Object.keys(values).length > 50
        )
            throw new BadRequestException('변경할 속성을 1~50개 지정하세요.');
        const prepared = await Promise.all(
            Object.entries(values).map(([propertyId, value]) =>
                this.prepareCell(teamId, userId, id, documentId, propertyId, value),
            ),
        );
        if (prepared.some((item) => !item.before || item.before.revision !== revision))
            throw new ConflictException('다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.');
        const patch = Object.fromEntries(prepared.map((item) => [`values.${item.prop.id}`, item.value]));
        const result = await this.rows.updateOne(
            { teamId, databaseId: id, documentId, revision },
            { $set: { ...patch, updatedBy: userId }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.');
        for (const { prop, value, before } of prepared) {
            if (prop.type !== 'person' || !Array.isArray(value)) continue;
            const previous = (before?.values[prop.id] ?? []) as string[];
            this.events.emit(NOTIFICATION_EVENTS.DOCUMENT_ASSIGNED, {
                teamId,
                actorId: userId,
                documentId,
                recipientIds: (value as string[]).filter((id) => !previous.includes(id)),
            });
        }
        return { revision: revision + 1 };
    }

    async mention(teamId: string, userId: string, id: string, documentId: string, recipientIds: string[]) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        const parent = db.parentDocumentId ? await this.documents.findById(db.parentDocumentId) : null;
        const [doc, row, team] = await Promise.all([
            this.documents.findById(documentId),
            this.rows.findOne({ teamId, databaseId: id, documentId }).lean(),
            this.teams.findById(teamId),
        ]);
        if (!row || !doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
            throw new NotFoundException('문서를 찾을 수 없습니다.');
        if (
            recipientIds.some((id) => {
                const member = team?.getMember(String(id));
                return (
                    !member ||
                    !doc.canView(String(id), member.role) ||
                    (!!parent && !parent.canView(String(id), member.role))
                );
            })
        )
            throw new BadRequestException('페이지에 공유된 사람만 호출할 수 있습니다.');
        this.events.emit(NOTIFICATION_EVENTS.DOCUMENT_ASSIGNED, {
            teamId,
            actorId: userId,
            documentId,
            recipientIds,
            mention: true,
        });
        return { sent: true };
    }

    async query(teamId: string, userId: string, id: string, dto: DatabaseQueryDto) {
        const db = await this.read(teamId, userId, id);
        try {
            const rows = queryDatabaseRows(db.rows, db.properties, dto);
            const offset = dto.offset ?? 0,
                limit = dto.limit ?? 50;
            return {
                ...db,
                rows: rows.slice(offset, offset + limit),
                total: rows.length,
                nextOffset: offset + limit < rows.length ? offset + limit : null,
            };
        } catch (error) {
            throw new BadRequestException((error as Error).message);
        }
    }

    async addView(teamId: string, userId: string, id: string, dto: AddViewDto, viewId?: string) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제한 후 구조를 변경하세요.');
        const properties = await this.completeProperties(teamId, userId, id);
        const knownColumns = new Set(['title', ...properties.map((prop) => prop.id)]);
        if (
            dto.propertyOrder &&
            (new Set(dto.propertyOrder).size !== dto.propertyOrder.length ||
                dto.propertyOrder.some((key) => !knownColumns.has(key)))
        )
            throw new BadRequestException('열 순서를 확인하세요.');
        if (
            dto.columnWidths &&
            (typeof dto.columnWidths !== 'object' ||
                Array.isArray(dto.columnWidths) ||
                Object.keys(dto.columnWidths).length > 501 ||
                Object.entries(dto.columnWidths).some(
                    ([key, value]) => !knownColumns.has(key) || !Number.isInteger(value) || value < 120 || value > 800,
                ))
        )
            throw new BadRequestException('열 너비는 120~800 사이의 정수로 지정하세요.');
        try {
            validateDatabaseQuery({ filter: dto.filter, sorts: dto.sorts }, properties);
        } catch (error) {
            throw new BadRequestException((error as Error).message);
        }
        if (
            dto.calculations &&
            (typeof dto.calculations !== 'object' ||
                Array.isArray(dto.calculations) ||
                Object.keys(dto.calculations).length > 50 ||
                Object.entries(dto.calculations).some(
                    ([key, value]) =>
                        !properties.some((p) => !p.archived && p.id === key) ||
                        !Object.hasOwn(AGGREGATION_LABELS, value),
                ))
        )
            throw new BadRequestException('열 계산 설정을 확인하세요.');
        const materializeDefault = viewId === 'default' && !db.views.length;
        if (viewId && !materializeDefault && !db.views.some((view) => view.id === viewId))
            throw new NotFoundException('보기를 찾을 수 없습니다.');
        if (!dto.name.trim() || (!viewId && (db.views?.length ?? 0) >= 50))
            throw new BadRequestException('보기 이름과 개수(최대 50개)를 확인하세요.');
        const { revision, ...config } = dto;
        const view = { ...config, id: viewId ?? new Types.ObjectId().toHexString(), name: dto.name.trim() };
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision, ...(viewId && !materializeDefault ? { 'views.id': viewId } : {}) },
            viewId && !materializeDefault
                ? { $set: { 'views.$': view }, $inc: { revision: 1 } }
                : {
                      $push: {
                          views: {
                              $each:
                                  !viewId && !db.views.length
                                      ? [
                                            {
                                                id: 'default',
                                                name: '표',
                                                layout: 'table',
                                                query: '',
                                                status: '',
                                                owner: '',
                                                sort: 'manual',
                                                dataSourceId: id,
                                            },
                                            view,
                                        ]
                                      : [view],
                          },
                      },
                      $inc: { revision: 1 },
                  },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return view;
    }
    async removeView(teamId: string, userId: string, id: string, viewId: string, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제하세요.');
        if (db.views.length <= 1) throw new BadRequestException('마지막 보기는 삭제할 수 없습니다.');
        if (!db.views.some((view) => view.id === viewId)) throw new NotFoundException('보기를 찾을 수 없습니다.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            { $pull: { views: { id: viewId } }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return { revision: revision + 1 };
    }

    async memberships(teamId: string, userId: string, documentId: string) {
        const { role } = await this.access.requireMember(teamId, userId);
        if (!isMongoId(documentId)) throw new NotFoundException('문서를 찾을 수 없습니다.');
        const doc = await this.documents.findById(documentId);
        if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
            throw new NotFoundException('문서를 찾을 수 없습니다.');
        const rows = await this.rows.find({ teamId, documentId }).lean();
        const available = new Set((await this.list(teamId, userId)).map((source) => source.id));
        return Promise.all(
            rows
                .filter((row) => available.has(row.databaseId))
                .map((row) => this.read(teamId, userId, row.databaseId, documentId)),
        );
    }

    async renameProperty(teamId: string, userId: string, id: string, propertyId: string, dto: RenamePropertyDto) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제한 후 구조를 변경하세요.');
        if (!dto.name.trim() || !db.properties.some((prop) => prop.id === propertyId))
            throw new BadRequestException('속성을 확인하세요.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision: dto.revision, 'properties.id': propertyId },
            { $set: { 'properties.$.name': dto.name.trim() }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('속성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
    }
    async archiveProperty(
        teamId: string,
        userId: string,
        id: string,
        propertyId: string,
        archived: boolean,
        revision: number,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제한 후 구조를 변경하세요.');
        if (!db.properties.some((prop) => prop.id === propertyId))
            throw new NotFoundException('속성을 찾을 수 없습니다.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision, 'properties.id': propertyId },
            { $set: { 'properties.$.archived': archived }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('속성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return { revision: revision + 1 };
    }
    async setLock(teamId: string, userId: string, id: string, locked: boolean, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        this.assertDocumentSource(await this.database(teamId, id, userId, true));
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            { $set: { locked }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return { locked, revision: revision + 1 };
    }
    private async ensureRowNumbers(teamId: string, id: string) {
        const missing = await this.rows
            .find({ teamId, databaseId: id, isTemplate: { $ne: true }, sequence: { $exists: false } })
            .select('_id')
            .sort({ createdAt: 1, _id: 1 })
            .lean();
        if (!missing.length) return;
        const reserved = await this.databases
            .findOneAndUpdate({ _id: id, teamId }, { $inc: { nextRowNumber: missing.length } }, { new: true })
            .lean();
        if (!reserved) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
        const first = reserved.nextRowNumber - missing.length + 1;
        await this.rows.bulkWrite(
            missing.map((row, index) => ({
                updateOne: {
                    filter: { _id: row._id, sequence: { $exists: false } },
                    update: { $set: { sequence: first + index } },
                    timestamps: false,
                },
            })),
        );
    }
    private async createTemplateDocument(
        teamId: string,
        userId: string,
        creationId: string,
        title: string,
        source?: import('../document/domain/document.entity').DocumentEntity,
        parentDocumentId?: string,
    ) {
        if (source?.id === creationId) throw new BadRequestException('원본과 다른 페이지 ID가 필요합니다.');
        let document = await this.documents.findById(creationId);
        if (!document) {
            try {
                document = await this.createDocument.execute({
                    id: creationId,
                    teamId,
                    title,
                    content: source?.content ?? '',
                    contentFormat: source?.contentFormat ?? 'json',
                    parentId: parentDocumentId ?? null,
                    inheritPermissions: !!parentDocumentId,
                    createdBy: userId,
                    ...(source
                        ? {
                              visibility: source.visibility,
                              editPolicy: source.editPolicy,
                              allowedViewerIds: source.allowedViewerIds,
                              allowedEditorIds: source.allowedEditorIds,
                          }
                        : {}),
                });
            } catch (error) {
                if ((error as { code?: number }).code !== 11000) throw error;
                document = await this.documents.findById(creationId);
            }
        }
        if (!document || document.teamId !== teamId || document.createdBy !== userId || document.isArchived)
            throw new NotFoundException('생성한 페이지를 찾을 수 없습니다.');
        return document;
    }
    async createRowPage(
        teamId: string,
        userId: string,
        id: string,
        title: string,
        creationId: string,
        values: Record<string, PropertyValue> = {},
    ) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        if (db.sourceKind === 'issues') return this.issueSource.create(teamId, userId, title, creationId, values);
        if (!title.trim()) throw new BadRequestException('페이지 이름을 입력하세요.');
        if (db.defaultTemplateId) {
            return this.applyTemplate(teamId, userId, id, db.defaultTemplateId, creationId, values, title.trim());
        }
        const document = await this.createTemplateDocument(
            teamId,
            userId,
            creationId,
            title.trim(),
            undefined,
            db.parentDocumentId,
        );
        await this.addRow(teamId, userId, id, document.id, values);
        return { documentId: document.id };
    }
    async createTemplate(
        teamId: string,
        userId: string,
        id: string,
        name: string,
        creationId: string,
        revision: number,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        const existing = (db.templates ?? []).find((template) => template.id === creationId);
        if (existing) return existing;
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제하세요.');
        if (db.revision !== revision)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        if (!name.trim() || (db.templates?.length ?? 0) >= 50)
            throw new BadRequestException('템플릿 이름과 개수를 확인하세요.');
        const document = await this.createTemplateDocument(
            teamId,
            userId,
            creationId,
            name.trim(),
            undefined,
            db.parentDocumentId,
        );
        await this.rows.updateOne(
            { teamId, databaseId: id, documentId: document.id },
            { $setOnInsert: { values: {}, revision: 0, isTemplate: true, updatedBy: userId } },
            { upsert: true },
        );
        const template = { id: creationId, name: name.trim(), documentId: document.id };
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            { $push: { templates: template }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('템플릿 원본 페이지가 생성되었습니다. 새로고침 후 다시 시도하세요.');
        return template;
    }
    async applyTemplate(
        teamId: string,
        userId: string,
        id: string,
        templateId: string,
        creationId: string,
        overrides: Record<string, PropertyValue> = {},
        title?: string,
    ) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        const template = db.templates?.find((item) => item.id === templateId);
        const source = template ? await this.documents.findById(template.documentId) : null;
        if (!source || source.teamId !== teamId || source.isArchived || !source.canView(userId, role))
            throw new NotFoundException('템플릿을 찾을 수 없습니다.');
        const document = await this.createTemplateDocument(
            teamId,
            userId,
            creationId,
            title ?? source.title,
            source,
            db.parentDocumentId,
        );
        const detail = await this.read(teamId, userId, id, source.id);
        const defaults = Object.fromEntries(
            db.properties
                .filter(
                    (prop) =>
                        !prop.archived &&
                        ![
                            'unique_id',
                            'formula',
                            'rollup',
                            'created_time',
                            'created_by',
                            'last_edited_time',
                            'last_edited_by',
                        ].includes(prop.type),
                )
                .flatMap((prop) => {
                    const value = detail.rows[0]?.values[prop.id];
                    return value == null ? [] : [[prop.id, value]];
                }),
        );
        await this.addRow(teamId, userId, id, document.id, { ...defaults, ...overrides });
        return { documentId: document.id };
    }
    async renameDatabase(teamId: string, userId: string, id: string, name: string, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제하세요.');
        if (!name.trim()) throw new BadRequestException('이름을 입력하세요.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            { $set: { name: name.trim() }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount) throw new ConflictException('데이터베이스가 변경되었습니다. 다시 시도하세요.');
        return { revision: revision + 1 };
    }
    async duplicateRow(teamId: string, userId: string, id: string, documentId: string, creationId: string) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (!isMongoId(documentId)) throw new NotFoundException('페이지를 찾을 수 없습니다.');
        const source = await this.documents.findById(documentId);
        const row = await this.rows.findOne({ teamId, databaseId: id, documentId, isTemplate: { $ne: true } }).lean();
        if (!source || source.teamId !== teamId || source.isArchived || !source.canView(userId, role) || !row)
            throw new NotFoundException('페이지를 찾을 수 없습니다.');
        const detail = await this.read(teamId, userId, id, documentId);
        const values = Object.fromEntries(
            db.properties
                .filter(
                    (prop) =>
                        !prop.archived &&
                        ![
                            'formula',
                            'rollup',
                            'unique_id',
                            'created_time',
                            'created_by',
                            'last_edited_time',
                            'last_edited_by',
                        ].includes(prop.type),
                )
                .flatMap((prop) => {
                    const value = detail.rows[0]?.values[prop.id];
                    return value == null ? [] : [[prop.id, value]];
                }),
        );
        const document = await this.createTemplateDocument(
            teamId,
            userId,
            creationId,
            `${source.title} (복사본)`.slice(0, 200),
            source,
            db.parentDocumentId ?? source.parentId ?? undefined,
        );
        await this.addRow(teamId, userId, id, document.id, values);
        return { documentId: document.id };
    }
    async setDefaultTemplate(teamId: string, userId: string, id: string, templateId: string | null, revision: number) {
        const { role } = await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제하세요.');
        if (templateId) {
            const template = db.templates?.find((item) => item.id === templateId);
            const source = template ? await this.documents.findById(template.documentId) : null;
            if (!source || source.teamId !== teamId || source.isArchived || !source.canView(userId, role))
                throw new NotFoundException('템플릿을 찾을 수 없습니다.');
        }
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            { $set: { defaultTemplateId: templateId }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return { revision: revision + 1 };
    }
    async removeTemplate(teamId: string, userId: string, id: string, templateId: string, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        const db = await this.database(teamId, id, userId, true);
        this.assertDocumentSource(db);
        if (db.locked) throw new ForbiddenException('데이터베이스 잠금을 해제하세요.');
        const result = await this.databases.updateOne(
            { _id: id, teamId, revision },
            {
                $pull: { templates: { id: templateId } },
                ...(db.defaultTemplateId === templateId ? { $unset: { defaultTemplateId: 1 } } : {}),
                $inc: { revision: 1 },
            },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스가 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return { revision: revision + 1 };
    }
}
