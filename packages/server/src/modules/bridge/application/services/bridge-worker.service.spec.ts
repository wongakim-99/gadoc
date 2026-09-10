import { BridgeJobEntity } from '../../domain/bridge-job.entity';
import { BridgeWorkerService } from './bridge-worker.service';

function makeJob(id: string, webhookUrl = 'https://hooks.slack.com/services/test/bridge/path') {
    return new BridgeJobEntity(
        id,
        'team-1',
        'slack',
        'announcement',
        webhookUrl,
        '공지 제목',
        '공지 본문',
        null,
        'pending',
        0,
        new Date('2025-01-01T00:00:00.000Z'),
        null,
        null,
        null,
        new Date('2025-01-01T00:00:00.000Z'),
        new Date('2025-01-01T00:00:00.000Z'),
    );
}

describe('BridgeWorkerService', () => {
    const mockBridgeJobRepo = {
        claimDueJobs: jest.fn(),
        markSent: jest.fn(),
        markRetry: jest.fn(),
        markFailed: jest.fn(),
    };
    const mockWebhookClient = {
        deliver: jest.fn(),
    };

    let service: BridgeWorkerService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new BridgeWorkerService(mockBridgeJobRepo as any, mockWebhookClient as any, {
            now: () => new Date(),
        });
    });

    it('대기 중인 job을 성공적으로 외부 webhook으로 전달한다', async () => {
        mockBridgeJobRepo.claimDueJobs.mockResolvedValue([makeJob('job-1')]);

        const delivered = await service.processPending();

        expect(delivered).toBe(1);
        expect(mockWebhookClient.deliver).toHaveBeenCalledTimes(1);
        expect(mockBridgeJobRepo.markSent).toHaveBeenCalledWith('job-1', expect.any(Date));
    });

    it('실패한 job은 재시도 상태로 되돌린다', async () => {
        mockBridgeJobRepo.claimDueJobs.mockResolvedValue([makeJob('job-1')]);
        mockWebhookClient.deliver.mockRejectedValue(new Error('bridge down'));

        await service.processPending();

        expect(mockBridgeJobRepo.markRetry).toHaveBeenCalledWith('job-1', 'bridge down', 1, expect.any(Date));
    });
    it('DB 연결 실패를 처리하고 다음 주기에 다시 조회한다', async () => {
        jest.useFakeTimers();
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        mockBridgeJobRepo.claimDueJobs.mockRejectedValueOnce(new Error('Mongo unavailable')).mockResolvedValue([]);
        try {
            service.onModuleInit();
            await jest.advanceTimersByTimeAsync(3000);
            expect(mockBridgeJobRepo.claimDueJobs).toHaveBeenCalledTimes(2);
        } finally {
            service.onModuleDestroy();
            if (previousEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousEnv;
            jest.useRealTimers();
        }
    });
});
