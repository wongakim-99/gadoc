import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ timestamps: true, collection: 'knowledge_database_containers' })
export class DatabaseContainer {
    @Prop() parentDocumentId?: string;
    @Prop({ required: true, index: true }) teamId!: string;
    @Prop({ required: true }) name!: string;
    @Prop({ required: true }) createdBy!: string;
    @Prop({ type: [String], default: [] }) sourceIds!: string[];
    @Prop({ default: 0 }) revision!: number;
}
export const DatabaseContainerSchema = SchemaFactory.createForClass(DatabaseContainer);
