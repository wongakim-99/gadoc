import { MessageGateway } from './message.gateway';

describe('MessageGateway', () => {
    const mockSendMessageUseCase = { execute: jest.fn() };
    const mockReactMessageUseCase = { execute: jest.fn() };
    const mockMessageAccessService = {
        ensureChannelMember: jest.fn(),
        ensureChannelWriter: jest.fn(),
        ensureMessageInChannel: jest.fn(),
    };
    const mockJwtService = { verify: jest.fn() };

    let gateway: MessageGateway;
    let emitMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new MessageGateway(
            mockSendMessageUseCase as any,
            mockReactMessageUseCase as any,
            mockMessageAccessService as any,
            mockJwtService as any,
        );
        emitMock = jest.fn();
        gateway.server = {
            to: jest.fn().mockReturnValue({ emit: emitMock }),
        } as any;
        (gateway as any).huddleRooms.set(
            'channel-1',
            new Map([
                ['user-1', { audio: true, video: false, socketId: 'socket-1' }],
                ['user-2', { audio: true, video: false, socketId: 'socket-2' }],
                ['user-3', { audio: true, video: false, socketId: 'socket-3' }],
            ]),
        );
        mockMessageAccessService.ensureChannelWriter.mockResolvedValue({
            channel: { id: 'channel-1', teamId: 'team-1' },
        });
    });

    it('허들 offer를 실제 통화 중인 상대 소켓에만 전달한다', async () => {
        const client = {
            id: 'socket-1',
            data: { user: { userId: 'user-1', email: 'user-1@example.com' } },
            emit: jest.fn(),
        } as any;

        await gateway.handleHuddleOffer(
            {
                channelId: 'channel-1',
                targetUserId: 'user-2',
                offer: { type: 'offer', sdp: 'test-offer' },
            },
            client,
        );

        expect(mockMessageAccessService.ensureChannelWriter).toHaveBeenCalledWith('channel-1', 'user-1');
        expect(gateway.server.to).toHaveBeenCalledWith('socket-2');
        expect(emitMock).toHaveBeenCalledWith('huddle:offer', {
            channelId: 'channel-1',
            fromUserId: 'user-1',
            offer: { type: 'offer', sdp: 'test-offer' },
        });
    });
    it('같은 사용자의 다른 채팅 소켓 종료가 통화를 종료하지 않는다', () => {
        gateway.handleDisconnect({ id: 'sidebar-socket', data: { user: { userId: 'user-1' } } } as any);
        expect((gateway as any).huddleRooms.get('channel-1').has('user-1')).toBe(true);
        expect(emitMock).not.toHaveBeenCalled();
    });

    it('통화 소켓 종료 시 채널 정보를 포함해 참가자 퇴장을 알린다', () => {
        gateway.handleDisconnect({ id: 'socket-1', data: { user: { userId: 'user-1' } } } as any);
        expect((gateway as any).huddleRooms.get('channel-1').has('user-1')).toBe(false);
        expect(emitMock).toHaveBeenCalledWith('huddle:user-left', { channelId: 'channel-1', userId: 'user-1' });
    });

    it('다른 탭에서 동일 계정으로 중복 통화에 참가할 수 없다', async () => {
        const client = { id: 'other-tab', data: { user: { userId: 'user-1' } }, join: jest.fn() } as any;
        expect(await gateway.handleHuddleJoin({ channelId: 'channel-1' }, client)).toMatchObject({ ok: false });
        expect(client.join).not.toHaveBeenCalled();
    });

    it('허들에 참가하지 않은 소켓의 leave는 기존 통화를 제거하지 않는다', () => {
        gateway.handleHuddleLeave({ channelId: 'channel-1' }, {
            id: 'other-tab',
            data: { user: { userId: 'user-1' } },
            leave: jest.fn(),
        } as any);
        expect((gateway as any).huddleRooms.get('channel-1').has('user-1')).toBe(true);
    });

    it('권한 확인 중 나가면 늦은 join이 유령 참여자를 만들지 않는다', async () => {
        let resolveAccess!: (value: unknown) => void;
        mockMessageAccessService.ensureChannelWriter.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveAccess = resolve;
                }),
        );
        const client = {
            id: 'new-socket',
            data: { user: { userId: 'new-user' } },
            join: jest.fn(),
            leave: jest.fn(),
        } as any;
        const pending = gateway.handleHuddleJoin({ channelId: 'channel-1' }, client);
        gateway.handleHuddleLeave({ channelId: 'channel-1' }, client);
        resolveAccess({ channel: { id: 'channel-1' } });
        expect(await pending).toMatchObject({ ok: false });
        expect(client.join).not.toHaveBeenCalled();
        expect((gateway as any).huddleRooms.get('channel-1').has('new-user')).toBe(false);
    });

    it('소켓 room 참여 도중 연결이 끊겨도 참여자로 등록하지 않는다', async () => {
        let finishJoin!: () => void;
        const client = {
            id: 'new-socket',
            data: { user: { userId: 'new-user' } },
            join: jest.fn(
                () =>
                    new Promise<void>((resolve) => {
                        finishJoin = resolve;
                    }),
            ),
            leave: jest.fn(),
        } as any;
        const pending = gateway.handleHuddleJoin({ channelId: 'channel-1' }, client);
        await Promise.resolve();
        gateway.handleDisconnect(client);
        finishJoin();
        expect(await pending).toMatchObject({ ok: false });
        expect(client.leave).toHaveBeenCalledWith('huddle:channel-1');
        expect((gateway as any).huddleRooms.get('channel-1').has('new-user')).toBe(false);
    });
});
