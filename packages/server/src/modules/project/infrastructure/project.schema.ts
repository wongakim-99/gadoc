import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true, collection: 'workspace_projects' })
export class Project {
    @Prop({ required: true }) teamId!: string;
    @Prop({ required: true }) name!: string;
    @Prop({ required: true }) nameKey!: string;
    @Prop({ type: [String], default: [] }) channelIds!: string[];
    @Prop({ type: String, default: null }) documentId!: string | null;
    @Prop({ default: 0 }) revision!: number;
    @Prop({ required: true }) createdBy!: string;
    @Prop({ required: true }) updatedBy!: string;
    createdAt!: Date;
    updatedAt!: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ teamId: 1, nameKey: 1 }, { unique: true });
ProjectSchema.index(
    { teamId: 1, channelIds: 1 },
    {
        unique: true,
        partialFilterExpression: { 'channelIds.0': { $exists: true } },
    },
);
