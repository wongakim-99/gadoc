import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { authenticateSocketUser } from '../../../shared/lib/socket-auth';
import { corsOrigin } from '../../../shared/lib/security-config';
import { DocumentCollaborationService, DOCUMENT_SYNC } from './document-collaboration.service';

const colors = ['#61a8ff', '#e9a75c', '#68c7a0', '#e481a4', '#94b65b', '#6bbdcc'];
const roomName = (teamId: string, documentId: string) => `doc:${teamId}:${documentId}`;
@WebSocketGateway({ namespace: '/document', cors: { origin: corsOrigin, credentials: true } })
export class DocumentGateway implements OnGatewayDisconnect {
    @WebSocketServer() server!: Server;
    constructor(
        private readonly jwt: JwtService,
        private readonly documents: DocumentCollaborationService,
    ) {}
    private error(error: unknown) {
        return {
            ok: false,
            message:
                error instanceof HttpException && error.getStatus() < 500
                    ? error.message
                    : '공동 편집 연결을 처리하지 못했습니다.',
        };
    }
    @SubscribeMessage('document:join')
    async join(
        @ConnectedSocket() client: Socket,
        @MessageBody() input: { teamId: string; documentId: string; clientId: number },
    ) {
        try {
            const user = authenticateSocketUser(this.jwt, client);
            if (!Number.isInteger(input?.clientId) || input.clientId < 0 || input.clientId > 0xffffffff)
                throw new Error();
            const snapshot = await this.documents.snapshot(input.teamId, input.documentId, user.userId);
            if (client.data.document) await this.leave(client);
            const color =
                colors[[...user.userId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % colors.length];
            client.data.document = {
                ...input,
                userId: user.userId,
                user: { name: (user.username || '팀원').slice(0, 80), color },
                clock: 0,
                state: null,
            };
            await client.join(roomName(input.teamId, input.documentId));
            const peers = await this.server.in(roomName(input.teamId, input.documentId)).fetchSockets();
            return {
                ok: true,
                ...snapshot,
                user: client.data.document.user,
                peers: peers
                    .filter((peer) => peer.data.document?.state)
                    .map((peer) => this.presence(peer.data.document)),
            };
        } catch (error) {
            return this.error(error);
        }
    }
    private presence(data: any) {
        return { clientId: data.clientId, clock: data.clock, state: data.state };
    }
    @SubscribeMessage('document:update')
    async update(@ConnectedSocket() client: Socket, @MessageBody() input: { update: Uint8Array }) {
        try {
            const user = authenticateSocketUser(this.jwt, client),
                data = client.data.document;
            if (!data || data.userId !== user.userId) throw new Error();
            const now = Date.now();
            const count =
                client.data.updateRate?.until > now ? client.data.updateRate : { count: 0, until: now + 60_000 };
            client.data.updateRate = count;
            if (++count.count > 300) throw new Error();
            return {
                ok: true,
                ...(await this.documents.apply(data.teamId, data.documentId, user.userId, input?.update)),
            };
        } catch (error) {
            return this.error(error);
        }
    }
    @SubscribeMessage('document:awareness')
    async awareness(
        @ConnectedSocket() client: Socket,
        @MessageBody() input: { state: Record<string, unknown> | null; clock: number },
    ) {
        try {
            const user = authenticateSocketUser(this.jwt, client),
                data = client.data.document;
            if (
                !data ||
                !Number.isSafeInteger(input?.clock) ||
                input.clock < data.clock ||
                JSON.stringify(input.state).length > 4096
            )
                throw new Error();
            const { canEdit } = await this.documents.authorize(data.teamId, data.documentId, user.userId);
            if (Date.now() - (data.lastPresenceAt ?? 0) < 40) return { ok: true };
            data.lastPresenceAt = Date.now();
            data.clock = input.clock;
            data.state = input.state
                ? { cursor: input.state.cursor, editing: input.state.editing === true, user: data.user }
                : null;
            await this.broadcast(data.teamId, data.documentId, 'document:awareness', this.presence(data));
            return { ok: true, canEdit };
        } catch (error) {
            await this.leave(client);
            return this.error(error);
        }
    }
    @SubscribeMessage('document:leave')
    async leave(@ConnectedSocket() client: Socket) {
        const data = client.data.document;
        if (!data) return;
        delete client.data.document;
        await client.leave(roomName(data.teamId, data.documentId));
        await this.broadcast(data.teamId, data.documentId, 'document:awareness', {
            clientId: data.clientId,
            clock: data.clock + 1,
            state: null,
        });
    }
    handleDisconnect(client: Socket) {
        void this.leave(client);
    }
    private async broadcast(teamId: string, documentId: string, event: string, payload: unknown) {
        const clients = await this.server.in(roomName(teamId, documentId)).fetchSockets();
        for (const client of clients) {
            try {
                const user = authenticateSocketUser(this.jwt, client as unknown as Socket);
                await this.documents.authorize(teamId, documentId, user.userId);
                client.emit(event, payload);
            } catch {
                await client.leave(roomName(teamId, documentId));
                client.emit('document:denied', { message: '문서 접근 권한이 변경되었습니다.' });
            }
        }
    }
    @OnEvent(DOCUMENT_SYNC)
    async changed(event: { teamId: string; documentId: string; update?: Buffer; title: string; updatedAt: string }) {
        if (this.server) await this.broadcast(event.teamId, event.documentId, 'document:sync', event);
    }
}
