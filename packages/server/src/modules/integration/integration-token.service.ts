import { createHash, randomBytes } from 'node:crypto';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { z } from 'zod';
import { TeamAccessService } from '../team/application/services/team-access.service';
import type { TeamMemberRole } from '../team/domain/team.entity';

export const MCP_SCOPES = [
    'documents:read',
    'documents:write',
    'files:write',
    'databases:read',
    'databases:write',
] as const;
export type McpScope = (typeof MCP_SCOPES)[number];
export interface McpIdentity {
    tokenId: string;
    teamId: string;
    userId: string;
    role: TeamMemberRole;
    scopes: McpScope[];
}
export const tokenInput = z
    .object({
        name: z.string().trim().min(1).max(80),
        scopes: z.array(z.enum(MCP_SCOPES)).min(1).max(MCP_SCOPES.length),
        expiresInDays: z.number().int().min(1).max(90).default(30),
    })
    .strict();

export function tokenDigest(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class IntegrationTokenService implements OnModuleInit {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        private readonly teams: TeamAccessService,
    ) {}

    private get tokens() {
        return this.connection.collection('integration_tokens');
    }
    private get events() {
        return this.connection.collection('integration_events');
    }

    async onModuleInit() {
        await this.tokens.createIndex({ digest: 1 }, { unique: true });
        await this.tokens.createIndex({ teamId: 1, userId: 1, createdAt: -1 });
        await this.events.createIndex({ teamId: 1, userId: 1, createdAt: -1 });
        await this.events.createIndex({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
    }

    async issue(teamId: string, userId: string, input: unknown) {
        const parsed = tokenInput.safeParse(input);
        if (!parsed.success) throw new BadRequestException('연결 이름, 권한, 만료 기간을 확인해 주세요.');
        const { role } = await this.teams.requireMember(teamId, userId);
        if (role === 'guest' && parsed.data.scopes.some((scope) => scope.endsWith(':write'))) {
            throw new ForbiddenException('게스트는 읽기 전용 연결만 만들 수 있습니다.');
        }
        if (
            (await this.tokens.countDocuments({ teamId, userId, revokedAt: null, expiresAt: { $gt: new Date() } })) >=
            10
        ) {
            throw new BadRequestException('사용 중인 연결은 10개까지 만들 수 있습니다. 기존 연결을 폐기해 주세요.');
        }
        const token = `gd_mcp_${randomBytes(32).toString('base64url')}`;
        const createdAt = new Date();
        const row = {
            _id: new Types.ObjectId(),
            teamId,
            userId,
            name: parsed.data.name,
            digest: tokenDigest(token),
            prefix: token.slice(0, 13),
            scopes: [...new Set(parsed.data.scopes)],
            createdAt,
            expiresAt: new Date(createdAt.getTime() + parsed.data.expiresInDays * 86_400_000),
            revokedAt: null,
            lastUsedAt: null,
        };
        await this.tokens.insertOne(row);
        return { ...this.publicToken(row), token };
    }

    async list(teamId: string, userId: string) {
        await this.teams.requireMember(teamId, userId);
        const rows = await this.tokens.find({ teamId, userId }).sort({ createdAt: -1 }).limit(100).toArray();
        return rows.map((row) => this.publicToken(row));
    }

    async revoke(teamId: string, userId: string, id: string) {
        await this.teams.requireMember(teamId, userId);
        if (!/^[a-f0-9]{24}$/.test(id)) throw new BadRequestException('유효하지 않은 연결입니다.');
        await this.tokens.updateOne(
            { _id: new Types.ObjectId(id), teamId, userId },
            { $set: { revokedAt: new Date() } },
        );
        return { revoked: true };
    }

    async authenticate(authorization: string | undefined): Promise<McpIdentity> {
        const token = /^Bearer (gd_mcp_[A-Za-z0-9_-]{43})$/.exec(authorization ?? '')?.[1];
        if (!token) throw new UnauthorizedException('MCP 연결 키가 필요합니다.');
        const row = await this.tokens.findOne({
            digest: tokenDigest(token),
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        });
        if (!row) throw new UnauthorizedException('만료되었거나 폐기된 MCP 연결입니다.');
        const { role } = await this.teams.requireMember(row.teamId, row.userId);
        await this.tokens.updateOne({ _id: row._id }, { $set: { lastUsedAt: new Date() } });
        return { tokenId: String(row._id), teamId: row.teamId, userId: row.userId, role, scopes: row.scopes };
    }

    requireScope(identity: McpIdentity, scope: McpScope) {
        if (!identity.scopes.includes(scope) || (scope.endsWith(':write') && identity.role === 'guest')) {
            throw new ForbiddenException('이 MCP 연결에는 요청한 작업 권한이 없습니다.');
        }
    }

    async record(identity: McpIdentity, tool: string, outcome: 'success' | 'error') {
        // Document bodies, file bytes and credentials must never enter the activity log.
        await this.events.insertOne({
            teamId: identity.teamId,
            userId: identity.userId,
            tokenId: identity.tokenId,
            tool,
            outcome,
            createdAt: new Date(),
        });
    }

    async activity(teamId: string, userId: string) {
        await this.teams.requireMember(teamId, userId);
        return this.events
            .find({ teamId, userId }, { projection: { _id: 0, tool: 1, outcome: 1, createdAt: 1, tokenId: 1 } })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
    }

    private publicToken(row: Record<string, any>) {
        return {
            id: String(row._id),
            name: row.name,
            prefix: row.prefix,
            scopes: row.scopes,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
            lastUsedAt: row.lastUsedAt,
        };
    }
}
