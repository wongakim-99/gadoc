import { corsOrigin } from '../../../../shared/lib/security-config';
import type { NotificationPublisher } from '../../application/ports/notification-publisher.port';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { TEAM_REPOSITORY, type ITeamRepository } from '../../../team/domain/team.port';
import type { NotificationEntity } from '../../domain/notification.entity';
import { authenticateSocketUser, type SocketUser } from '../../../../shared/lib/socket-auth';
import { NotificationResourceService } from '../../application/services/notification-resource.service';

@WebSocketGateway({ namespace: '/notification', cors: { origin: corsOrigin, credentials: true } })
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect, NotificationPublisher {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        @Inject(TEAM_REPOSITORY) private readonly teamRepo: ITeamRepository,
        private readonly resources: NotificationResourceService,
    ) {}

    handleConnection(client: Socket) {
        try {
            client.data.user = authenticateSocketUser(this.jwtService, client);
        } catch {
            this.logger.warn(`Notification client rejected: ${client.id}`);
            client.emit('error', { message: 'Authentication required.' });
            client.disconnect();
            return;
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Notification client disconnected: ${client.id}`);
    }

    @SubscribeMessage('join_team_notifications')
    async handleJoinTeam(@MessageBody() data: { teamId: string }, @ConnectedSocket() client: Socket) {
        const user = this.getUser(client);
        const team = await this.teamRepo.findById(data.teamId);
        if (!team?.isMember(user.userId)) {
            throw new UnauthorizedException('워크스페이스 접근 권한이 없습니다.');
        }
        client.join(this.getRoomKey(data.teamId, user.userId));
        client.emit('joined_team_notifications', { teamId: data.teamId });
    }

    @SubscribeMessage('leave_team_notifications')
    handleLeaveTeam(@MessageBody() data: { teamId: string }, @ConnectedSocket() client: Socket) {
        const user = this.getUser(client);
        client.leave(this.getRoomKey(data.teamId, user.userId));
    }

    async emitNotification(notification: NotificationEntity) {
        try {
            const visible = await this.resources.filterVisible(notification.teamId, notification.recipientId, [notification]);
            if (visible.length) this.server
                .to(this.getRoomKey(notification.teamId, notification.recipientId))
                .emit('notification:new', notification.toPublic());
        } catch {
            // Revoked workspace access and lookup failures must not publish private metadata.
            this.logger.warn('알림 접근 권한을 확인하지 못해 실시간 전송을 생략했습니다.');
        }
    }

    emitNotificationRead(teamId: string, userId: string, notificationId: string) {
        this.server.to(this.getRoomKey(teamId, userId)).emit('notification:read', { id: notificationId });
    }

    emitNotificationsReadAll(teamId: string, userId: string) {
        this.server.to(this.getRoomKey(teamId, userId)).emit('notification:read_all');
    }

    private getRoomKey(teamId: string, userId: string) {
        return `notification:${teamId}:${userId}`;
    }

    private getUser(client: Socket) {
        return client.data.user as SocketUser;
    }
}
