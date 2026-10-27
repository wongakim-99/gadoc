import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { isMongoId } from 'class-validator';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { DatabaseContainer } from './container.schema';
import { KnowledgeDatabase } from './database.schema';
import { DatabaseService } from './database.service';
@Injectable()
export class DatabaseContainerService {
    constructor(
        @InjectModel(DatabaseContainer.name) private readonly containers: Model<DatabaseContainer>,
        @InjectModel(KnowledgeDatabase.name) private readonly sources: Model<KnowledgeDatabase>,
        private readonly databases: DatabaseService,
        private readonly access: TeamAccessService,
    ) {}
    private async container(teamId: string, id: string) {
        if (!isMongoId(id)) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
        let container = await this.containers.findOne({ _id: id, teamId }).lean();
        if (!container) {
            // Legacy block/source IDs remain valid. The wrapper never moves or copies rows.
            const source = await this.sources.findOne({ _id: id, teamId }).lean();
            if (!source) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
            try {
                await this.containers.updateOne(
                    { _id: id, teamId },
                    {
                        $setOnInsert: {
                            name: source.name,
                            parentDocumentId: source.parentDocumentId,
                            createdBy: source.createdBy,
                            sourceIds: [id],
                            revision: 0,
                        },
                    },
                    { upsert: true },
                );
            } catch (error) {
                if ((error as { code?: number }).code !== 11000) throw error;
            }
            container = await this.containers.findOne({ _id: id, teamId }).lean();
        }
        if (!container) throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
        return container;
    }
    async read(teamId: string, userId: string, id: string) {
        await this.access.requireMember(teamId, userId);
        const container = await this.container(teamId, id);
        if (container.parentDocumentId) await this.databases.assertPage(teamId, userId, container.parentDocumentId);
        const sources = await this.databases.list(teamId, userId);
        return {
            id: String(container._id),
            name: container.name,
            revision: container.revision,
            sources: container.sourceIds.flatMap((id) => {
                const source = sources.find((item) => item.id === id);
                return source ? [source] : [];
            }),
        };
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
        const id = creationId ?? new Types.ObjectId().toHexString();
        const existing = await this.containers.findById(id).lean();
        if (existing) {
            if (existing.teamId !== teamId || existing.createdBy !== userId)
                throw new NotFoundException('데이터베이스를 찾을 수 없습니다.');
            if (existing.name !== name.trim())
                throw new ConflictException('같은 생성 요청에 다른 이름을 사용할 수 없습니다.');
            return this.read(teamId, userId, id);
        }
        const sourceId = createHash('sha256').update(`slacord-source:${id}`).digest('hex').slice(0, 24);
        const source = await this.databases.create(teamId, userId, name, sourceId, parentDocumentId, blank);
        try {
            await this.containers.create({
                _id: id,
                teamId,
                name: source.name,
                parentDocumentId,
                createdBy: userId,
                sourceIds: [source.id],
            });
        } catch (error) {
            if ((error as { code?: number }).code !== 11000) throw error;
        }
        return this.read(teamId, userId, id);
    }
    async link(teamId: string, userId: string, id: string, sourceId: string, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        const container = await this.container(teamId, id);
        if (container.parentDocumentId)
            await this.databases.assertPage(teamId, userId, container.parentDocumentId, true);
        await this.databases.database(teamId, sourceId, userId);
        if (container.sourceIds.includes(sourceId)) return this.read(teamId, userId, id);
        if (container.sourceIds.length >= 50)
            throw new BadRequestException('데이터 소스는 최대 50개 연결할 수 있습니다.');
        const result = await this.containers.updateOne(
            { _id: id, teamId, revision },
            { $addToSet: { sourceIds: sourceId }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스 구성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return this.read(teamId, userId, id);
    }
    async createSource(
        teamId: string,
        userId: string,
        id: string,
        name: string,
        revision: number,
        creationId?: string,
        blank = false,
    ) {
        await this.access.requireWritableMember(teamId, userId);
        const container = await this.container(teamId, id);
        if (container.parentDocumentId)
            await this.databases.assertPage(teamId, userId, container.parentDocumentId, true);
        if (creationId && container.sourceIds.includes(creationId)) {
            await this.databases.create(teamId, userId, name, creationId, container.parentDocumentId, blank);
            return { sourceId: creationId };
        }
        if (container.revision !== revision) throw new ConflictException('데이터베이스 구성이 변경되었습니다.');
        if (container.sourceIds.length >= 50)
            throw new BadRequestException('데이터 소스는 최대 50개 연결할 수 있습니다.');
        const source = await this.databases.create(teamId, userId, name, creationId, container.parentDocumentId, blank);
        await this.link(teamId, userId, id, source.id, revision);
        return { sourceId: source.id };
    }
    async unlink(teamId: string, userId: string, id: string, sourceId: string, revision: number) {
        await this.access.requireWritableMember(teamId, userId);
        const container = await this.container(teamId, id);
        if (container.parentDocumentId)
            await this.databases.assertPage(teamId, userId, container.parentDocumentId, true);
        if (!container.sourceIds.includes(sourceId)) return this.read(teamId, userId, id);
        if (container.sourceIds.length <= 1)
            throw new BadRequestException('마지막 데이터 소스는 연결 해제할 수 없습니다.');
        const result = await this.containers.updateOne(
            { _id: id, teamId, revision },
            { $pull: { sourceIds: sourceId }, $inc: { revision: 1 } },
        );
        if (!result.modifiedCount)
            throw new ConflictException('데이터베이스 구성이 변경되었습니다. 새로고침 후 다시 시도하세요.');
        return this.read(teamId, userId, id);
    }
}
