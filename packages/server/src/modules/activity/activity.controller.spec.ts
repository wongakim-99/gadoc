import { ForbiddenException } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { TeamAccessService } from '../team/application/services/team-access.service';

describe('워크스페이스 사용자 활동 조회 권한', () => {
    it('일반 멤버와 다른 팀 관리자는 로그를 조회하지 못한다', async () => {
        const activity = { list: jest.fn() };
        const access = { requireAdmin: jest.fn().mockRejectedValue(new ForbiddenException()) };
        const controller = new ActivityController(
            activity as unknown as ActivityService,
            access as unknown as TeamAccessService,
        );
        await expect(controller.list('team-a', { userId: 'other-team-owner' })).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        expect(activity.list).not.toHaveBeenCalled();
    });

    it('운영자 권한을 먼저 확인한 팀에 한해서만 조회한다', async () => {
        const activity = { list: jest.fn().mockResolvedValue({ items: [] }) };
        const access = { requireAdmin: jest.fn().mockResolvedValue({ role: 'owner' }) };
        const controller = new ActivityController(
            activity as unknown as ActivityService,
            access as unknown as TeamAccessService,
        );
        await controller.list('team-a', { userId: 'owner-a' }, 'actor-a', undefined, '20');
        expect(access.requireAdmin).toHaveBeenCalledWith('team-a', 'owner-a');
        expect(activity.list).toHaveBeenCalledWith('team-a', { actorId: 'actor-a', before: undefined, limit: '20' });
    });
});
