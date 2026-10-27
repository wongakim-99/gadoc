import { NotificationDeliveryService } from './notification-delivery.controller';

describe('notification delivery claims', () => {
    it('uses an opaque per-user key and treats only duplicate-key errors as already delivered', async () => {
        const model = { create: jest.fn().mockResolvedValue({}) };
        const service = new NotificationDeliveryService(model as any);
        await expect(service.claim('team', 'user', 'message:1')).resolves.toEqual({ deliver: true });
        expect(model.create.mock.calls[0][0]._id).toMatch(/^[a-f0-9]{64}$/);
        model.create.mockRejectedValueOnce({ code: 11000 });
        await expect(service.claim('team', 'user', 'message:1')).resolves.toEqual({ deliver: false });
        await service.claim('team', 'different-user', 'message:1');
        expect(model.create.mock.calls[2][0]._id).not.toBe(model.create.mock.calls[0][0]._id);
        model.create.mockRejectedValueOnce(new Error('database offline'));
        await expect(service.claim('team', 'user', 'message:2')).rejects.toThrow('database offline');
    });
});
