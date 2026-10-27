import { z } from 'zod';
import { AGGREGATION_LABELS, type FilterGroup } from '@slacord/document-core';
import type { DatabaseService } from '../knowledge-database/database.service';
import type { DatabaseContainerService } from '../knowledge-database/container.service';
import type { GetTeamMembersUseCase } from '../team/application/use-cases/get-team-members.use-case';
import type { McpIdentity, McpScope } from './integration-token.service';

export type RegisterMcpTool = <S extends z.ZodRawShape>(
    name: string,
    description: string,
    scope: McpScope,
    schema: S,
    action: (input: z.output<z.ZodObject<S>>) => Promise<unknown>,
) => void;
const id = z.string().regex(/^[a-f0-9]{24}$/);
const propertyId = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/);
const revision = z.number().int().min(0);
const scalar = z.union([z.string().max(10_000), z.number().finite(), z.boolean(), z.null()]);
const value = z.union([scalar, z.array(scalar).max(100)]);
const values = z
    .record(propertyId, value)
    .refine((input) => Object.keys(input).length <= 100, '최대 100개 속성을 한 번에 수정할 수 있습니다.');
const sorts = z.array(z.object({ propertyId, direction: z.enum(['ascending', 'descending']) }).strict()).max(20);
const rule = z
    .object({
        propertyId,
        operator: z.enum([
            'equals',
            'not_equals',
            'contains',
            'not_contains',
            'starts_with',
            'ends_with',
            'is_empty',
            'is_not_empty',
            'greater_than',
            'greater_or_equal',
            'less_than',
            'less_or_equal',
        ]),
        value: scalar.optional(),
    })
    .strict();
const group1 = z.object({ conjunction: z.enum(['and', 'or']), rules: z.array(rule).max(100) }).strict();
const group2 = z
    .object({ conjunction: z.enum(['and', 'or']), rules: z.array(z.union([rule, group1])).max(100) })
    .strict();
const filter = z
    .object({ conjunction: z.enum(['and', 'or']), rules: z.array(z.union([rule, group2])).max(100) })
    .strict();
const property = {
    name: z.string().trim().min(1).max(80),
    type: z.enum([
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
    ]),
    options: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    targetDatabaseId: id.optional(),
    relationPropertyId: propertyId.optional(),
    targetPropertyId: propertyId.optional(),
    aggregation: z
        .enum(
            Object.keys(AGGREGATION_LABELS) as [
                keyof typeof AGGREGATION_LABELS,
                ...Array<keyof typeof AGGREGATION_LABELS>,
            ],
        )
        .optional(),
    formula: z.string().max(4000).optional(),
    cardinality: z.enum(['one', 'many']).optional(),
    bidirectional: z.boolean().optional(),
    inverseName: z.string().trim().min(1).max(80).optional(),
    prefix: z.string().max(20).optional(),
    revision,
};

export function registerDatabaseTools(
    register: RegisterMcpTool,
    actor: McpIdentity,
    db: DatabaseService,
    containers: DatabaseContainerService,
    members: GetTeamMembersUseCase,
) {
    const { teamId, userId } = actor;
    register(
        'workspace_members',
        'List member IDs and display names for people properties. Assignment never grants access.',
        'databases:read',
        {},
        async () =>
            (await members.execute(teamId, userId)).map((member) => ({
                userId: member.userId,
                name: member.user?.username ?? '',
                role: member.role,
            })),
    );
    register(
        'databases_list',
        'List existing accessible GaDoc database sources and schemas. Reuse these; do not create a duplicate when the user names an existing inline database.',
        'databases:read',
        {},
        () => db.list(teamId, userId),
    );
    register(
        'database_container_get',
        'Resolve an inline block databaseId into existing source IDs. A container and its data source can have different IDs.',
        'databases:read',
        { containerId: id },
        ({ containerId }) => containers.read(teamId, userId, containerId),
    );
    register(
        'database_query',
        'Read authorized rows, computed relations/rollups/formulas, saved views and current schema/row revisions. Supports AND/OR filters, sorting and pagination. Use source ID, not container ID.',
        'databases:read',
        {
            databaseId: id,
            search: z.string().max(200).optional(),
            filter: filter.optional(),
            sorts: sorts.optional(),
            limit: z.number().int().min(1).max(100).default(50),
            offset: z.number().int().min(0).max(100_000).default(0),
        },
        ({ databaseId, ...query }) =>
            db.query(teamId, userId, databaseId, { ...query, filter: query.filter as FilterGroup | undefined }),
    );
    register(
        'database_create',
        'Create an inline-compatible database only when requested. Returns container ID and source IDs; put container ID in a document database block. parentDocumentId applies document permissions. Reuse creationId on retries.',
        'databases:write',
        {
            name: z.string().trim().min(1).max(100),
            creationId: id,
            parentDocumentId: id.optional(),
        },
        ({ name, creationId, parentDocumentId }) =>
            containers.create(teamId, userId, name, creationId, parentDocumentId, true),
    );
    register(
        'database_property_add',
        'Add a typed property to the existing database. Relations connect existing pages; rollups aggregate visible related values. Pass the current database schema revision.',
        'databases:write',
        { databaseId: id, ...property },
        ({ databaseId, ...input }) => db.addProperty(teamId, userId, databaseId, input),
    );
    register(
        'database_property_configure',
        'Configure an existing property without changing its stable ID. Requires current database revision. Never replace a property silently to change its type.',
        'databases:write',
        { databaseId: id, propertyId, ...property },
        ({ databaseId, propertyId: target, ...input }) =>
            db.configureProperty(teamId, userId, databaseId, target, input),
    );
    register(
        'database_row_create',
        'Create a real document row in the existing database. values maps property IDs to typed values; dates use YYYY-MM-DD. Reuse a 24-hex creationId on retries. The page uses database permissions.',
        'databases:write',
        {
            databaseId: id,
            title: z.string().trim().min(1).max(200),
            creationId: id,
            values: values.optional(),
        },
        ({ databaseId, title, creationId, values }) =>
            db.createRowPage(teamId, userId, databaseId, title, creationId, values),
    );
    register(
        'database_row_update',
        'Atomically update properties on an existing row using its current row revision. Use document_update for title/body. Relation values contain document IDs, not row IDs.',
        'databases:write',
        {
            databaseId: id,
            documentId: id,
            revision,
            values,
        },
        ({ databaseId, documentId, revision, values }) =>
            db.updateCells(teamId, userId, databaseId, documentId, values, revision),
    );
    register(
        'database_view_save',
        'Create or update a view on the SAME source, never duplicate rows. Supports table, board, list, gallery, calendar, timeline and chart. Use dateProperty/endProperty for schedules; these must be existing date properties.',
        'databases:write',
        {
            databaseId: id,
            viewId: z
                .string()
                .regex(/^(default|[a-f0-9]{24})$/)
                .optional(),
            name: z.string().trim().min(1).max(80),
            layout: z.enum(['table', 'board', 'list', 'gallery', 'calendar', 'timeline', 'chart']),
            revision,
            dateProperty: propertyId.optional(),
            endProperty: propertyId.optional(),
            groupProperty: propertyId.optional(),
            hiddenProperties: z.array(propertyId).max(50).optional(),
            propertyOrder: z.array(propertyId).max(500).optional(),
            filter: filter.optional(),
            sorts: sorts.optional(),
            query: z.string().max(200).default(''),
        },
        ({ databaseId, viewId, ...view }) =>
            db.addView(
                teamId,
                userId,
                databaseId,
                {
                    ...view,
                    filter: view.filter as FilterGroup | undefined,
                    dataSourceId: databaseId,
                    status: '',
                    owner: '',
                    sort: 'manual',
                },
                viewId,
            ),
    );
}
