import { MessageEntity } from '../../domain/message.entity';
import { SendMessageUseCase } from './send-message.use-case';

function makeMessage(id: string, mentions: string[]) {
    return new MessageEntity(
        id,
        'team-1',
        'channel-1',
        'user-1',
        'writer',
        'hello',
        'text',
        [],
        null,
        [],
        mentions,
        null,
        null,
        false,
        false,
        null,
        new Date('2026-04-14T01:00:00.000Z'),
        new Date('2026-04-14T01:00:00.000Z'),
    );
}

describe('SendMessageUseCase', () => {
    const mockMessageRepo = {
        save: jest.fn(),
        findById: jest.fn(),
    };
    const mockEventEmitter = { emit: jest.fn() };
    const mockMentions = { resolve: jest.fn() };

    let useCase: SendMessageUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        mockMentions.resolve.mockResolvedValue([]);
        mockMessageRepo.findById.mockResolvedValue(null);
        useCase = new SendMessageUseCase(mockMessageRepo as any, mockMentions as any, mockEventEmitter as any);
    });

    it('팀 멤버 username을 실제 사용자 ID로 해석해 멘션 알림을 만든다', async () => {
        const savedMessage = makeMessage('message-1', ['user-2', 'user-3']);
        mockMentions.resolve.mockResolvedValue(['user-2', 'user-3']);
        mockMessageRepo.save.mockResolvedValue(savedMessage);

        const result = await useCase.execute({
            teamId: 'team-1',
            channelId: 'channel-1',
            authorId: 'user-1',
            authorName: 'writer',
            content: '안녕 @alice, @bob! @missing @writer',
        });

        expect(mockMessageRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                mentions: ['user-2', 'user-3'],
            }),
        );
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
            'notification.mentioned',
            expect.objectContaining({
                recipientIds: ['user-2', 'user-3'],
                resourceId: 'message-1',
                resourceType: 'message',
            }),
        );
        expect(result).toBe(savedMessage);
    });

    it.each([
        { teamId: 'other-team', channelId: 'channel-1' },
        { teamId: 'team-1', channelId: 'other-channel' },
    ])('rejects a reply whose parent belongs to a different scope: %o', async (scope) => {
        mockMessageRepo.findById.mockResolvedValue({ ...makeMessage('parent', []), ...scope });
        await expect(
            useCase.execute({
                teamId: 'team-1',
                channelId: 'channel-1',
                authorId: 'user-1',
                authorName: 'writer',
                content: 'reply',
                replyToId: 'parent',
            }),
        ).rejects.toThrow('같은 채널');
        expect(mockMessageRepo.save).not.toHaveBeenCalled();
        expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does not create a second thread notification for an explicitly mentioned parent author', async () => {
        mockMessageRepo.findById.mockResolvedValue({ ...makeMessage('parent', []), authorId: 'user-2' });
        mockMentions.resolve.mockResolvedValue(['user-2']);
        mockMessageRepo.save.mockResolvedValue(makeMessage('reply', ['user-2']));
        await useCase.execute({
            teamId: 'team-1',
            channelId: 'channel-1',
            authorId: 'user-1',
            authorName: 'writer',
            content: '@parent reply',
            replyToId: 'parent',
        });
        expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
            'notification.mentioned',
            expect.objectContaining({ recipientIds: ['user-2'] }),
        );
    });
});
