import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { isMongoId } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { authenticateSocketUser } from '../../shared/lib/socket-auth';
import { TEAM_REPOSITORY, type ITeamRepository } from '../team/domain/team.port';
import { CONTENT_CHANGED } from '../../shared/interceptors/content-change.interceptor';

@WebSocketGateway({ namespace: '/database', cors: { origin: true, credentials: true } })
export class DatabaseGateway implements OnGatewayConnection {
    @WebSocketServer() server!: Server;
    constructor(
        private readonly jwt: JwtService,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
    ) {}
    handleConnection(client: Socket) {
        try {
            client.data.user = authenticateSocketUser(this.jwt, client);
        } catch {
            client.disconnect(true);
        }
    }
    @SubscribeMessage('database:subscribe')
    async subscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { teamId?: string }) {
        try {
            if (typeof data?.teamId !== 'string' || !isMongoId(data.teamId)) throw new Error();
            const user = authenticateSocketUser(this.jwt, client);
            const team = await this.teams.findById(data.teamId);
            if (!team?.isMember(user.userId)) throw new Error();
            await client.join(`database:${data.teamId}`);
            client.emit('database:changed', { teamId: data.teamId });
            return { subscribed: true };
        } catch {
            return { subscribed: false };
        }
    }
    @SubscribeMessage('database:unsubscribe')
    unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { teamId?: string }) {
        if (typeof data?.teamId === 'string') void client.leave(`database:${data.teamId}`);
    }
    @OnEvent(CONTENT_CHANGED)
    async changed({ teamId, sourceId, resourceKind }: { teamId: string; sourceId?: string; resourceKind?: string }) {
        if (!this.server) return;
        const team = await this.teams.findById(teamId);
        const clients = await this.server.in(`database:${teamId}`).fetchSockets();
        for (const client of clients) {
            try {
                const user = authenticateSocketUser(this.jwt, client as unknown as Socket);
                if (!team?.isMember(user.userId)) {
                    await client.leave(`database:${teamId}`);
                    continue;
                }
                // Invalidate only: never broadcast document titles, property values or people.
                client.emit('database:changed', { teamId, ...(sourceId ? { sourceId, resourceKind } : {}) });
            } catch {
                client.disconnect(true);
            }
        }
    }
}
