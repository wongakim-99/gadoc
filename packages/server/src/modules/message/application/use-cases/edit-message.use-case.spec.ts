import { EditMessageUseCase } from './edit-message.use-case';

describe('edited message mentions', () => {
    const repo = { findById: jest.fn(), updateContent: jest.fn() };
    const mentions = { resolve: jest.fn() };
    const events = { emit: jest.fn() };
    const useCase = new EditMessageUseCase(repo as any, mentions as any, events as any);
    const before = {
        id: 'message',
        teamId: 'team',
        channelId: 'room',
        authorId: 'author',
        authorName: 'Writer',
        type: 'text',
        content: 'before @alice',
        mentions: ['alice'],
    };
    beforeEach(() => {
        jest.resetAllMocks();
        repo.findById.mockResolvedValue(before);
        repo.updateContent.mockResolvedValue({ ...before, content: 'after @alice @bob', mentions: ['alice', 'bob'] });
        mentions.resolve.mockResolvedValue(['alice', 'bob']);
    });
    it('updates content and mentions atomically and alerts only newly added people', async () => {
        await useCase.execute('message', 'author', ' after @alice @bob ');
        expect(repo.updateContent).toHaveBeenCalledWith('message', 'after @alice @bob', {
            mentions: ['alice', 'bob'],
            expectedContent: before.content,
        });
        expect(events.emit).toHaveBeenCalledTimes(1);
        expect(events.emit).toHaveBeenCalledWith(
            'notification.mentioned',
            expect.objectContaining({ recipientIds: ['bob'], resourceId: 'message', channelId: 'room' }),
        );
    });
    it('does not duplicate notifications for unchanged content or existing mentions', async () => {
        await useCase.execute('message', 'author', before.content);
        expect(repo.updateContent).not.toHaveBeenCalled();
        expect(events.emit).not.toHaveBeenCalled();
        mentions.resolve.mockResolvedValue(['alice']);
        await useCase.execute('message', 'author', 'changed @alice');
        expect(events.emit).not.toHaveBeenCalled();
    });
    it('removes stale mention IDs without deleting historical inbox records', async () => {
        mentions.resolve.mockResolvedValue([]);
        await useCase.execute('message', 'author', 'no mention');
        expect(repo.updateContent).toHaveBeenCalledWith('message', 'no mention', {
            mentions: [],
            expectedContent: before.content,
        });
        expect(events.emit).not.toHaveBeenCalled();
    });
    it('never emits for a failed concurrent write and preserves authorship checks', async () => {
        repo.updateContent.mockResolvedValue(null);
        await expect(useCase.execute('message', 'author', 'after @bob')).rejects.toThrow('메시지가 변경');
        expect(events.emit).not.toHaveBeenCalled();
        await expect(useCase.execute('message', 'other', 'changed')).rejects.toThrow('작성자만');
        await expect(useCase.execute('message', 'author', '   ')).rejects.toThrow('내용');
    });
});
