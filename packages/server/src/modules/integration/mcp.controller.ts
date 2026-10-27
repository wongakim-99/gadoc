import { All, Controller, ForbiddenException, HttpException, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { isAllowedOrigin } from '../../shared/lib/security-config';
import { IntegrationTokenService } from './integration-token.service';
import { McpServerService } from './mcp-server.service';

@Controller('mcp')
export class McpController {
    private readonly requests = new Map<string, { count: number; until: number }>();
    constructor(
        private readonly tokens: IntegrationTokenService,
        private readonly servers: McpServerService,
    ) {}

    @All()
    async handle(@Req() req: Request, @Res() res: Response) {
        res.setHeader('Cache-Control', 'private, no-store');
        if (!isAllowedOrigin(req.headers.origin)) throw new ForbiddenException('허용되지 않은 출처입니다.');
        const identity = await this.tokens.authenticate(req.headers.authorization);
        const now = Date.now();
        for (const [key, value] of this.requests) if (value.until <= now) this.requests.delete(key);
        const bucket = this.requests.get(identity.tokenId) ?? { count: 0, until: now + 60_000 };
        if (this.requests.size >= 10_000 || ++bucket.count > 120) {
            res.setHeader('Retry-After', '60');
            throw new HttpException('분당 MCP 요청 한도를 초과했습니다.', 429);
        }
        this.requests.set(identity.tokenId, bucket);
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            res.status(405).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Use stateless Streamable HTTP POST.' },
                id: null,
            });
            return;
        }
        const server = this.servers.create(identity);
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.once('close', () => {
            void transport.close();
            void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
}
