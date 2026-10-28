import 'reflect-metadata';
import { DatabaseService } from './database.service';
import { BadRequestException } from '@nestjs/common';

describe('status group writes', () => {
    const create = () => {
        const databases = { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
        const access = { requireWritableMember: jest.fn().mockResolvedValue({ role: 'owner' }) };
        const service = new DatabaseService(databases as never, {} as never, {} as never, {} as never, access as never, {} as never, {} as never, {} as never);
        jest.spyOn(service, 'database').mockResolvedValue({ properties: [], revision: 0 } as never);
        jest.spyOn(service as any, 'completeProperties').mockResolvedValue([]);
        return { service, databases };
    };
    it('persists group membership before writing the property', async () => {
        const { service, databases } = create();
        const property = await service.addProperty('team', 'user', 'database', {
            name: '단계', type: 'status', options: ['검토'], statusGroups: [{ name: '검토', group: 'in_progress' }], revision: 0,
        });
        const persisted = databases.updateOne.mock.calls[0][1].$push.properties;
        expect(persisted.statusOptionGroups).toEqual([{ optionId: property.optionIdentities![0].id, group: 'in_progress' }]);
    });
    it('rejects invalid group configuration without partially creating a property', async () => {
        const { service, databases } = create();
        await expect(service.addProperty('team', 'user', 'database', {
            name: '텍스트', type: 'text', statusGroups: [], revision: 0,
        })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.addProperty('team', 'user', 'database', {
            name: '단계', type: 'status', options: ['검토'], statusGroups: [{ name: '없는 옵션', group: 'todo' }], revision: 0,
        })).rejects.toBeInstanceOf(BadRequestException);
        expect(databases.updateOne).not.toHaveBeenCalled();
    });
});
