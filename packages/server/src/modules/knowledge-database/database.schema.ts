import type { StatusOptionGroup, OptionIdentity, OptionColorSetting } from '@slacord/document-core';
import type { NumberFormat } from '@slacord/document-core';
import type { FilterGroup, SortRule, Aggregation } from '@slacord/document-core';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema } from 'mongoose';

export type PropertyType =
    | 'text'
    | 'number'
    | 'person'
    | 'status'
    | 'date'
    | 'checkbox'
    | 'url'
    | 'select'
    | 'multi_select'
    | 'relation'
    | 'rollup'
    | 'email'
    | 'phone'
    | 'created_time'
    | 'created_by'
    | 'last_edited_time'
    | 'last_edited_by'
    | 'formula'
    | 'unique_id';
export interface DatabaseProperty {
    id: string;
    name: string;
    archived?: boolean;
    prefix?: string;
    numberFormat?: NumberFormat;
    type: PropertyType;
    options?: string[];
    optionColors?: OptionColorSetting[];
    optionIdentities?: OptionIdentity[];
    statusOptionGroups?: StatusOptionGroup[];
    formula?: string;
    formulaReferences?: Array<{ name: string; id: string }>;
    targetDatabaseId?: string;
    relationPropertyId?: string;
    targetPropertyId?: string;
    aggregation?: Aggregation;
    cardinality?: 'one' | 'many';
    inverse?: { id: string; name: string };
    reverseOf?: { databaseId: string; propertyId: string };
}
export type PropertyValue = string | number | boolean | Array<string | number | boolean | null> | null;
export interface DatabaseView {
    id: string;
    name: string;
    layout: 'table' | 'board' | 'list' | 'gallery' | 'calendar' | 'timeline' | 'chart';
    filter?: FilterGroup;
    sorts?: SortRule[];
    dateProperty?: string;
    endProperty?: string;
    dataSourceId?: string;
    groupProperty?: string;
    statusGrouping?: 'option' | 'group';
    hiddenProperties?: string[];
    propertyOrder?: string[];
    columnWidths?: Record<string, number>;
    calculations?: Record<string, Aggregation>;
    query: string;
    status: string;
    owner: string;
    sort: 'manual' | 'title' | 'title-desc' | 'reviewDate';
}

@Schema({ timestamps: true, collection: 'knowledge_databases' })
export class KnowledgeDatabase {
    @Prop({ default: '이름' }) titlePropertyName!: string;
    @Prop({ enum: ['issues'] }) sourceKind?: 'issues';
    @Prop() defaultTemplateId?: string;
    @Prop() parentDocumentId?: string;
    @Prop({ required: true, index: true }) teamId!: string;
    @Prop({ required: true }) name!: string;
    @Prop({ type: [MongoSchema.Types.Mixed], default: [] }) properties!: DatabaseProperty[];
    @Prop({ default: 0 }) nextRowNumber!: number;
    @Prop({ default: false }) locked!: boolean;
    @Prop({ default: 0 }) revision!: number;
    @Prop({ type: [MongoSchema.Types.Mixed], default: [] }) templates!: Array<{
        id: string;
        name: string;
        documentId: string;
    }>;
    @Prop({ required: true }) createdBy!: string;
    @Prop({ type: [MongoSchema.Types.Mixed], default: [] }) views!: DatabaseView[];
}
export const KnowledgeDatabaseSchema = SchemaFactory.createForClass(KnowledgeDatabase);

@Schema({ timestamps: true, collection: 'knowledge_database_rows' })
export class DatabaseRow {
    @Prop() sequence?: number;
    @Prop({ default: false }) isTemplate!: boolean;
    @Prop({ required: true }) teamId!: string;
    @Prop({ required: true }) databaseId!: string;
    @Prop({ required: true }) documentId!: string;
    @Prop() updatedBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
    @Prop({ type: MongoSchema.Types.Mixed, default: {} }) values!: Record<string, PropertyValue>;
    @Prop({ default: 0 }) revision!: number;
}
export const DatabaseRowSchema = SchemaFactory.createForClass(DatabaseRow);
DatabaseRowSchema.index({ teamId: 1, databaseId: 1, documentId: 1 }, { unique: true });

DatabaseRowSchema.index(
    { teamId: 1, databaseId: 1, sequence: 1 },
    { unique: true, partialFilterExpression: { sequence: { $exists: true } } },
);
