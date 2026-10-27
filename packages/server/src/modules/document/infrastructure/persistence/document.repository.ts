import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { IDocumentRepository } from '../../domain/document.port';
import type { DocumentEntity } from '../../domain/document.entity';
import { DocumentEntity as Entity } from '../../domain/document.entity';
import { Doc, type DocumentDocument } from './document.schema';

@Injectable()
export class DocumentRepository implements IDocumentRepository {
    constructor(@InjectModel(Doc.name) private readonly model: Model<DocumentDocument>) {}

    private toEntity(doc: DocumentDocument, parent?: DocumentEntity | null): DocumentEntity {
        return new Entity(
            String(doc._id),
            doc.teamId,
            doc.title,
            doc.content ?? '',
            doc.contentFormat ?? 'plain',
            doc.parentId,
            doc.createdBy,
            doc.updatedBy,
            doc.externalSource ?? null,
            doc.externalId ?? null,
            doc.externalUrl ?? null,
            doc.visibility ?? 'team',
            doc.editPolicy ?? 'all',
            doc.allowedViewerIds ?? [],
            doc.allowedEditorIds ?? [],
            doc.archivedAt ?? null,
            doc.archivedBy ?? null,
            doc.createdAt,
            doc.updatedAt,
            doc.inheritPermissions ? (parent ?? null) : undefined,
        );
    }

    private resolveList(documents: DocumentDocument[]): DocumentEntity[] {
        const raw = new Map(documents.map((doc) => [String(doc._id), doc]));
        const resolved = new Map<string, DocumentEntity>();
        const resolving = new Set<string>();
        const resolve = (doc: DocumentDocument): DocumentEntity => {
            const id = String(doc._id);
            if (resolved.has(id)) return resolved.get(id)!;
            if (resolving.has(id) || resolving.size >= 100) return this.toEntity(doc, null);
            resolving.add(id);
            const parent = doc.inheritPermissions && doc.parentId ? raw.get(doc.parentId) : undefined;
            const entity = this.toEntity(doc, parent && parent.teamId === doc.teamId ? resolve(parent) : null);
            resolving.delete(id);
            resolved.set(id, entity);
            return entity;
        };
        return documents.map(resolve);
    }
    async findByTeam(teamId: string, includeArchived = false): Promise<DocumentEntity[]> {
        const documents = await this.model.find({ teamId }).sort({ parentId: 1, createdAt: 1 }).lean();
        return this.resolveList(documents as DocumentDocument[]).filter((doc) => includeArchived || !doc.isArchived);
    }
    async findMetadataByTeam(teamId: string): Promise<DocumentEntity[]> {
        const documents = await this.model.find({ teamId }).select('-content').lean();
        return this.resolveList(documents as DocumentDocument[]).filter((doc) => !doc.isArchived);
    }
    async findById(id: string): Promise<DocumentEntity | null> {
        const visited = new Set<string>();
        const resolve = async (documentId: string): Promise<DocumentEntity | null> => {
            if (visited.has(documentId) || visited.size >= 100) return null;
            visited.add(documentId);
            const doc = await this.model.findById(documentId).lean();
            if (!doc) return null;
            const parent = doc.inheritPermissions && doc.parentId ? await resolve(doc.parentId) : null;
            return this.toEntity(doc as DocumentDocument, parent?.teamId === doc.teamId ? parent : null);
        };
        return resolve(id);
    }

    async save(data: {
        id?: string;
        inheritPermissions?: boolean;
        visibility?: 'team' | 'restricted';
        editPolicy?: 'owner_admin' | 'all' | 'restricted';
        allowedViewerIds?: string[];
        allowedEditorIds?: string[];
        teamId: string;
        title: string;
        content: string;
        contentFormat?: 'plain' | 'html' | 'json';
        parentId: string | null;
        createdBy: string;
    }): Promise<DocumentEntity> {
        const { id, ...values } = data;
        const doc = await this.model.create({
            ...values,
            ...(id ? { _id: id } : {}),
            contentFormat: data.contentFormat ?? 'plain',
            updatedBy: data.createdBy,
        });
        return (await this.findById(String(doc._id)))!;
    }

    async upsertExternal(data: {
        teamId: string;
        title: string;
        content: string;
        contentFormat: 'plain' | 'html' | 'json';
        parentId: string | null;
        createdBy: string;
        updatedBy: string;
        externalSource: string;
        externalId: string;
        externalUrl: string | null;
    }): Promise<DocumentEntity> {
        const doc = await this.model
            .findOneAndUpdate(
                { teamId: data.teamId, externalSource: data.externalSource, externalId: data.externalId },
                {
                    $set: {
                        title: data.title,
                        content: data.content,
                        contentFormat: data.contentFormat,
                        parentId: data.parentId,
                        updatedBy: data.updatedBy,
                        externalUrl: data.externalUrl,
                    },
                    $setOnInsert: {
                        teamId: data.teamId,
                        createdBy: data.createdBy,
                        externalSource: data.externalSource,
                        externalId: data.externalId,
                    },
                },
                { new: true, upsert: true },
            )
            .lean();
        return this.toEntity(doc as DocumentDocument);
    }

    async update(
        id: string,
        data: {
            title?: string;
            content?: string;
            contentFormat?: 'plain' | 'html' | 'json';
            updatedBy: string;
            visibility?: 'team' | 'restricted';
            editPolicy?: 'owner_admin' | 'all' | 'restricted';
            allowedViewerIds?: string[];
            allowedEditorIds?: string[];
        },
    ): Promise<DocumentEntity | null> {
        const doc = await this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
        return doc ? this.toEntity(doc as DocumentDocument) : null;
    }

    async archiveById(id: string, archivedBy: string): Promise<DocumentEntity | null> {
        const doc = await this.model
            .findByIdAndUpdate(id, { $set: { archivedAt: new Date(), archivedBy } }, { new: true })
            .lean();
        return doc ? this.toEntity(doc as DocumentDocument) : null;
    }

    async restoreById(id: string): Promise<DocumentEntity | null> {
        const doc = await this.model
            .findByIdAndUpdate(id, { $set: { archivedAt: null, archivedBy: null } }, { new: true })
            .lean();
        return doc ? this.toEntity(doc as DocumentDocument) : null;
    }

    async archiveByParentId(parentId: string, archivedBy: string): Promise<number> {
        const result = await this.model.updateMany(
            { parentId, archivedAt: null },
            { $set: { archivedAt: new Date(), archivedBy } },
        );
        return result.modifiedCount;
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return result !== null;
    }
}
