import { NotificationGateway } from './notification.gateway';
import { NotificationEntity } from '../../domain/notification.entity';

describe('live notification metadata', () => {
    const notice = new NotificationEntity(
        'notice',
        'team',
        'recipient',
        'mention',
        'actor',
        'Actor',
        'private content',
        'message',
        'message',
        'channel',
        false,
        new Date(),
    );
    const resources = { filterVisible: jest.fn() };
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const gateway = new NotificationGateway({} as any, {} as any, resources as any);
    gateway.server = { to } as any;
    beforeEach(() => jest.clearAllMocks());

    it('publishes inbox events for accessible records independently of desktop mute', async () => {
        resources.filterVisible.mockResolvedValue([notice]);
        await gateway.emitNotification(notice);
        expect(resources.filterVisible).toHaveBeenCalledWith('team', 'recipient', [notice]);
        expect(to).toHaveBeenCalledWith('notification:team:recipient');
        expect(emit).toHaveBeenCalledWith('notification:new', notice.toPublic());
    });

    it('does not publish private metadata after access revocation or a failed access lookup', async () => {
        resources.filterVisible.mockResolvedValue([]);
        await gateway.emitNotification(notice);
        expect(to).not.toHaveBeenCalled();
        resources.filterVisible.mockRejectedValue(new Error('access revoked'));
        await expect(gateway.emitNotification(notice)).resolves.toBeUndefined();
        expect(to).not.toHaveBeenCalled();
    });
});
