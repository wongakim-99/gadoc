import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TEAM_REPOSITORY, type ITeamRepository } from '../team/domain/team.port';
import { USER_REPOSITORY, type IUserRepository } from '../auth/domain/auth.port';
import { authenticateSocketUser } from '../../shared/lib/socket-auth';
import { corsOrigin } from '../../shared/lib/security-config';

@WebSocketGateway({ namespace: '/profile', cors: { origin: corsOrigin, credentials: true } })
export class ProfileGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;

    constructor(
        private readonly jwt: JwtService,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    ) {}

    async handleConnection(client: Socket) {
        try {
            const { userId } = authenticateSocketUser(this.jwt, client);
            if (!/^[a-f0-9]{24}$/.test(userId) || !(await this.users.findById(userId))) throw new Error();
            await client.join(`user:${userId}`);
            client.emit('profile_ready');
        } catch {
            client.disconnect(true);
        }
    }

    @OnEvent('profile.updated')
    async changed({ userId }: { userId: string }) {
        // Only an invalidation is sent. Receiving clients reauthorize the identity and image requests.
        try {
            const teams = await this.teams.findByMember(userId);
            const peers = new Set([userId, ...teams.flatMap((team) => team.members.map((member) => member.userId))]);
            this.server.to([...peers].map((id) => `user:${id}`)).emit('profile_changed', { userId });
        } catch {
            /* Focus/reconnect refresh also recovers missed invalidations. */
        }
    }
}
