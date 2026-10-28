import type { FilterGroup, SortRule, Aggregation } from '@slacord/document-core';
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
export type PropertyValue = string | number | boolean | Array<string | number | boolean | null> | null;
export interface DatabaseProperty {
    id: string;
    name: string;
    archived?: boolean;
    prefix?: string;
    type: PropertyType;
    options?: string[];
    formula?: string;
    formulaReferences?: Array<{ name: string; id: string }>;
    targetDatabaseId?: string;
    relationPropertyId?: string;
    targetPropertyId?: string;
    aggregation?: Aggregation;
    cardinality?: 'one' | 'many';
    bidirectional?:boolean;
    inverseName?:string;
    inverse?: {id:string;name:string};
    reverseOf?: {databaseId:string;propertyId:string};
}
export interface KnowledgeDatabase {
    sourceKind?: 'issues';
    parentDocumentId?: string | null;
    locked?: boolean;
    id: string;
    name: string;
    properties: DatabaseProperty[];
    revision: number;
}
export interface DatabaseRow {
    resourceKind?: 'issue';
    documentId: string;
    title: string;
    canEdit: boolean;
    revision: number;
    formulaErrors?: Record<string, string>;
    relationRevisions?:Record<string,string>;
    availablePersonIds: string[];
    values: Record<string, PropertyValue>;
    relations: Record<string, Array<{ id: string; title: string }>>;
}
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
    hiddenProperties?: string[];
    propertyOrder?: string[];
    columnWidths?: Record<string, number>;
    calculations?: Record<string, Aggregation>;
    query: string;
    status: string;
    owner: string;
    sort: 'manual' | 'title' | 'title-desc' | 'reviewDate';
}
export interface DatabaseDetail extends KnowledgeDatabase {
    canEditSchema?: boolean;
    templates?: Array<{ id: string; name: string; documentId: string }>;
    defaultTemplateId?: string;
    archivedProperties?: DatabaseProperty[];
    rows: DatabaseRow[];
    views: DatabaseView[];
}
export const PROPERTY_LABELS: Record<PropertyType, string> = {
    text: '텍스트',
    number: '숫자',
    person: '담당자',
    status: '상태',
    date: '날짜',
    checkbox: '체크박스',
    url: 'URL',
    select: '선택',
    multi_select: '다중 선택',
    relation: '관계형',
    rollup: '롤업',
    email: '이메일',
    phone: '전화번호',
    created_time: '생성 일시',
    created_by: '생성자',
    last_edited_time: '최종 편집 일시',
    last_edited_by: '최종 편집자',
    formula: '수식',
    unique_id: 'ID',
};

export interface DatabaseContainer {
    id: string;
    name: string;
    revision: number;
    sources: KnowledgeDatabase[];
}
