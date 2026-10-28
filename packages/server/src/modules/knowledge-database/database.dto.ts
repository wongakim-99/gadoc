import { OPTION_COLORS, type OptionColor } from '@slacord/document-core';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NUMBER_FORMATS, type NumberFormat } from '@slacord/document-core';
import { AGGREGATION_LABELS, type Aggregation } from '@slacord/document-core';
import type { FilterGroup, SortRule } from '@slacord/document-core';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsMongoId,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Max,
    MinLength,
    Allow,
} from 'class-validator';
import type { PropertyType, PropertyValue } from './database.schema';

export class CreateDatabaseDto {
    @IsString() @MinLength(1) @MaxLength(100) name!: string;
}
export class RenameDatabaseDto extends CreateDatabaseDto {
    @IsInt() @Min(0) revision!: number;
}
export class OptionColorDto {
    @IsString() @MinLength(1) @MaxLength(80) name!: string;
    @IsIn(OPTION_COLORS) color!: OptionColor;
}
export class AddPropertyDto {
    @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OptionColorDto)
    optionColors?: OptionColorDto[];
    @IsOptional() @IsIn(NUMBER_FORMATS) numberFormat?: NumberFormat;
    @IsOptional() @IsBoolean() bidirectional?: boolean;
    @IsOptional() @IsString() @MaxLength(80) inverseName?: string;
    @IsOptional() @IsString() @MaxLength(20) prefix?: string;
    @IsString() @MinLength(1) @MaxLength(80) name!: string;
    @IsIn([
        'text',
        'number',
        'person',
        'status',
        'date',
        'checkbox',
        'url',
        'select',
        'multi_select',
        'relation',
        'rollup',
        'email',
        'phone',
        'created_time',
        'created_by',
        'last_edited_time',
        'last_edited_by',
        'formula',
        'unique_id',
    ])
    type!: PropertyType;
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ArrayUnique()
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    options?: string[];
    @IsOptional() @IsString() @MaxLength(4000) formula?: string;
    @IsOptional() @IsMongoId() targetDatabaseId?: string;
    @IsOptional() @IsString() @MaxLength(40) relationPropertyId?: string;
    @IsOptional() @IsString() @MaxLength(40) targetPropertyId?: string;
    @IsOptional() @IsIn(Object.keys(AGGREGATION_LABELS)) aggregation?: Aggregation;
    @IsOptional() @IsIn(['one', 'many']) cardinality?: 'one' | 'many';
    @IsInt() @Min(0) revision!: number;
}
export class AddRowDto {
    @IsOptional() @Allow() values?: Record<string, PropertyValue>;
    @IsMongoId() documentId!: string;
}
export class MentionRowDto {
    @IsArray() @ArrayUnique() @ArrayMaxSize(20) @IsMongoId({ each: true }) recipientIds!: string[];
}
export class UpdateCellDto {
    @IsOptional() @IsString() @MaxLength(64) relationRevision?: string;
    @IsInt() @Min(0) revision!: number;
    // The service validates the value against the persisted property type.
    @Allow() value!: PropertyValue;
}
export class AddViewDto {
    @IsOptional() @IsString() @MaxLength(24) dataSourceId?: string;
    @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) propertyOrder?: string[];
    @IsOptional() @Allow() columnWidths?: Record<string, number>;
    @IsOptional() @Allow() calculations?: Record<string, import('@slacord/document-core').Aggregation>;
    @IsString() @MinLength(1) @MaxLength(80) name!: string;
    @IsIn(['table', 'board', 'list', 'gallery', 'calendar', 'timeline', 'chart']) layout!:
        | 'table'
        | 'board'
        | 'list'
        | 'gallery'
        | 'calendar'
        | 'timeline'
        | 'chart';
    @IsOptional() @Allow() filter?: FilterGroup;
    @IsOptional() @Allow() sorts?: SortRule[];
    @IsOptional() @IsString() @MaxLength(40) dateProperty?: string;
    @IsOptional() @IsString() @MaxLength(40) endProperty?: string;
    @IsOptional() @IsString() @MaxLength(40) groupProperty?: string;
    @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) hiddenProperties?: string[];
    @IsString() @MaxLength(200) query!: string;
    @IsString() @MaxLength(80) status!: string;
    @IsString() @MaxLength(24) owner!: string;
    @IsIn(['manual', 'title', 'title-desc', 'reviewDate']) sort!: 'manual' | 'title' | 'title-desc' | 'reviewDate';
    @IsInt() @Min(0) revision!: number;
}
export class RenamePropertyDto {
    @IsString() @MinLength(1) @MaxLength(80) name!: string;
    @IsInt() @Min(0) revision!: number;
}

export class DatabaseQueryDto {
    @IsOptional() @Allow() filter?: FilterGroup;
    @IsOptional() @Allow() sorts?: SortRule[];
    @IsOptional() @IsString() @MaxLength(200) search?: string;
    @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
    @IsOptional() @IsInt() @Min(0) offset?: number;
}

export class PropertyRevisionDto {
    @IsInt() @Min(0) revision!: number;
}

export class DatabaseLockDto {
    @IsBoolean() locked!: boolean;
    @IsInt() @Min(0) revision!: number;
}

export class UpdateRowDto {
    @Allow() values!: Record<string, PropertyValue>;
    @IsInt() @Min(0) revision!: number;
}

export class CreateTemplateDto {
    @IsString() @MinLength(1) @MaxLength(80) name!: string;
    @IsMongoId() creationId!: string;
    @IsInt() @Min(0) revision!: number;
}
export class ApplyTemplateDto {
    @IsMongoId() creationId!: string;
}
export class DefaultTemplateDto {
    @IsOptional() @IsMongoId() templateId?: string | null;
    @IsInt() @Min(0) revision!: number;
}

export class CreateRowPageDto {
    @IsOptional() @IsMongoId() projectId?: string | null;
    @IsMongoId() creationId!: string;
    @IsString() @MinLength(1) @MaxLength(200) title!: string;
    @IsOptional() @Allow() values?: Record<string, PropertyValue>;
}
