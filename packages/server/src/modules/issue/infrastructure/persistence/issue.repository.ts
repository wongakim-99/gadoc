import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONTENT_CHANGED } from '../../../../shared/interceptors/content-change.interceptor';
import { issueSourceId } from '../../domain/issue-source';
import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IIssueRepository, type IssueSearchFilters } from '../../domain/issue.port';
import { IssueEntity, IssuePriority, IssueStatus } from '../../domain/issue.entity';
import { Issue, IssueDocument } from './issue.schema';
import type { IssueLink } from '../../domain/issue-link';

/** Issue Repository Adapter - MongoDB 구현체 */
@Injectable()
export class IssueRepository implements IIssueRepository {
    constructor(
        @InjectModel(Issue.name) private readonly issueModel: Model<IssueDocument>,
        @Optional() private readonly events?: EventEmitter2,
    ) {}

    private changed(teamId: string) {
        this.events?.emit(CONTENT_CHANGED, { teamId, sourceId: issueSourceId(teamId), resourceKind: 'issue' });
    }

    async findLinked(teamId: string, link: Pick<IssueLink, 'kind' | 'resourceId'>) {
        const docs = await this.issueModel
            .find({ teamId, links: { $elemMatch: link } })
            .sort({ updatedAt: -1 })
            .limit(100)
            .lean();
        return docs.map((doc) => this.toEntity(doc as IssueDocument));
    }

    async addLink(id: string, teamId: string, link: IssueLink) {
        // The predicate and append are atomic, including duplicate/size protection.
        const result = await this.issueModel.updateOne(
            {
                _id: id,
                teamId,
                links: { $not: { $elemMatch: { kind: link.kind, resourceId: link.resourceId } } },
                'links.49': { $exists: false },
            },
            { $push: { links: link }, $inc: { revision: 1 } },
        );
        if (result.modifiedCount) this.changed(teamId);
        return result.modifiedCount > 0;
    }

    async removeLink(id: string, teamId: string, kind: IssueLink['kind'], resourceId: string) {
        const result = await this.issueModel.updateOne(
            { _id: id, teamId },
            { $pull: { links: { kind, resourceId } }, $inc: { revision: 1 } },
        );
        if (result.modifiedCount) this.changed(teamId);
    }

    async findByTeam(teamId: string, filters?: IssueSearchFilters): Promise<IssueEntity[]> {
        const query: Record<string, unknown> = { teamId };
        if (filters?.status) query.status = filters.status;
        if (filters?.assigneeId === 'unassigned') {
            query['assigneeIds.0'] = { $exists: false };
        } else if (filters?.assigneeId) {
            query.assigneeIds = filters.assigneeId;
        }
        if (filters?.query?.trim()) {
            const pattern = new RegExp(escapeRegExp(filters.query.trim()), 'i');
            query.$or = [{ title: pattern }, { description: pattern }];
        }
        const docs = await this.issueModel.find(query).sort({ createdAt: -1 }).lean();
        return docs.map((d) => this.toEntity(d as IssueDocument));
    }

    async findById(id: string): Promise<IssueEntity | null> {
        const doc = await this.issueModel.findById(id).lean();
        return doc ? this.toEntity(doc as IssueDocument) : null;
    }

    async save(data: {
        teamId: string;
        title: string;
        description: string;
        priority: IssuePriority;
        assigneeIds: string[];
        labels: string[];
        createdBy: string;
        links?: IssueLink[];
    }): Promise<IssueEntity> {
        const doc = await this.issueModel.create(data);
        this.changed(String(doc.teamId));
        return this.toEntity(doc);
    }

    async update(
        id: string,
        data: Partial<{
            title: string;
            description: string;
            status: IssueStatus;
            priority: IssuePriority;
            assigneeIds: string[];
            labels: string[];
        }>,
        revision?: number,
    ): Promise<IssueEntity | null> {
        const update = { $set: data, $inc: { revision: 1 } };
        const doc = await (revision === undefined
            ? this.issueModel.findByIdAndUpdate(id, update, { new: true })
            : this.issueModel.findOneAndUpdate({ _id: id,
                ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }),
            }, update, { new: true })).lean();
        if (doc) this.changed(String(doc.teamId));
        return doc ? this.toEntity(doc as IssueDocument) : null;
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.issueModel.findByIdAndDelete(id);
        if (result) this.changed(String(result.teamId));
        return result !== null;
    }

    private toEntity(doc: IssueDocument): IssueEntity {
        return new IssueEntity(
            String(doc._id),
            doc.teamId.toString(),
            doc.title,
            doc.description ?? '',
            doc.status as IssueStatus,
            doc.priority as IssuePriority,
            doc.assigneeIds ?? [],
            doc.labels ?? [],
            doc.createdBy,
            doc.createdAt,
            doc.updatedAt,
            doc.links ?? [],
            doc.revision ?? 0,
        );
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
