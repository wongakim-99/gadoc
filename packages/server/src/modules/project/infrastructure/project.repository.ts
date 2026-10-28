import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import { projectNameKey, type StoredWorkspaceProject } from '../domain/project';
import type { IProjectRepository, CreateWorkspaceProject, UpdateWorkspaceProject } from '../domain/project.port';
import { Project, type ProjectDocument } from './project.schema';

@Injectable()
export class ProjectRepository implements IProjectRepository {
    constructor(@InjectModel(Project.name) private readonly model: Model<ProjectDocument>) {}

    private entity(doc: ProjectDocument): StoredWorkspaceProject {
        return {
            id: String(doc._id),
            teamId: doc.teamId,
            name: doc.name,
            channelIds: doc.channelIds ?? [],
            documentId: doc.documentId ?? null,
            revision: doc.revision ?? 0,
            createdBy: doc.createdBy,
            updatedBy: doc.updatedBy,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }

    async findByTeam(teamId: string) {
        const docs = await this.model.find({ teamId }).sort({ createdAt: 1 }).lean();
        return docs.map((doc) => this.entity(doc as ProjectDocument));
    }

    async findById(id: string) {
        if (!isValidObjectId(id)) return null;
        const doc = await this.model.findById(id).lean();
        return doc ? this.entity(doc as ProjectDocument) : null;
    }

    async findByChannel(teamId: string, channelId: string) {
        const doc = await this.model.findOne({ teamId, channelIds: channelId }).lean();
        return doc ? this.entity(doc as ProjectDocument) : null;
    }

    async save(data: CreateWorkspaceProject) {
        const doc = await this.model.create({
            ...(data.id ? { _id: data.id } : {}),
            teamId: data.teamId,
            name: data.name.trim(),
            nameKey: projectNameKey(data.name),
            channelIds: data.channelIds,
            documentId: data.documentId,
            createdBy: data.createdBy,
            updatedBy: data.createdBy,
        });
        return this.entity(doc);
    }

    async update(id: string, teamId: string, revision: number, data: UpdateWorkspaceProject) {
        const values = {
            updatedBy: data.updatedBy,
            ...(data.name !== undefined ? { name: data.name.trim(), nameKey: projectNameKey(data.name) } : {}),
            ...(data.channelIds !== undefined ? { channelIds: data.channelIds } : {}),
            ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
        };
        const doc = await this.model
            .findOneAndUpdate(
                { _id: id, teamId, revision },
                {
                    $set: values,
                    $inc: { revision: 1 },
                },
                { new: true },
            )
            .lean();
        return doc ? this.entity(doc as ProjectDocument) : null;
    }
}
