import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEntity } from '../auth/domain/user.entity';
import { ProfileService, profileAvatarUrl } from './profile.service';
import { deflateSync } from 'node:zlib';

const owner = '111111111111111111111111',
    peer = '222222222222222222222222',
    outsider = '333333333333333333333333';
const version = '11111111-1111-4111-8111-111111111111.png';
const oldUrl = profileAvatarUrl(owner, version);
const user = (url: string | null = oldUrl) =>
    new UserEntity(owner, 'private@example.com', '현재 이름', 'hash', url, new Date('2026-01-01'));

// Synthetic image generated in memory; no user image is retained as a fixture.
function image() {
    const chunk = (type: string, data: Buffer) => {
        const result = Buffer.alloc(data.length + 12);
        result.writeUInt32BE(data.length);
        result.write(type, 4);
        data.copy(result, 8);
        let crc = 0xffffffff;
        for (const byte of result.subarray(4, -4)) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
        return result;
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(1);
    header.writeUInt32BE(1, 4);
    header[8] = 8;
    header[9] = 6;
    return {
        buffer: Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            chunk('IHDR', header),
            chunk('IDAT', deflateSync(Buffer.from([0, 40, 100, 180, 255]))),
            chunk('IEND', Buffer.alloc(0)),
        ]),
        mimetype: 'image/png',
    };
}

describe('ProfileService', () => {
    let service: ProfileService;
    let users: { findById: jest.Mock; replaceAvatar: jest.Mock };
    let teams: { findByMember: jest.Mock };
    let storage: { read: jest.Mock; upload: jest.Mock };
    let events: EventEmitter2;
    beforeEach(() => {
        users = {
            findById: jest.fn().mockResolvedValue(user()),
            replaceAvatar: jest.fn().mockImplementation(async (_id, _expected, url) => user(url)),
        };
        teams = {
            findByMember: jest
                .fn()
                .mockImplementation(async (id) =>
                    id === peer ? [{ isMember: (target: string) => target === owner }] : [],
                ),
        };
        storage = {
            read: jest.fn().mockResolvedValue({ mimeType: 'image/png' }),
            upload: jest.fn().mockResolvedValue({}),
        };
        events = new EventEmitter2();
        jest.spyOn(events, 'emit');
        service = new ProfileService(users as any, teams as any, storage as any, events);
    });
    it('lets a personal profile exist without a workspace, and never returns email or password in identity', async () => {
        const identity = await service.identity(owner, owner);
        expect(identity).not.toHaveProperty('email');
        expect(identity).not.toHaveProperty('passwordHash');
        expect(teams.findByMember).not.toHaveBeenCalled();
    });
    it('checks current shared membership for identity and each image read, and denies old/guessed versions', async () => {
        await service.read(owner, version, owner);
        await service.read(owner, version, peer);
        await expect(service.read(owner, version, outsider)).rejects.toThrow();
        await expect(service.identity(owner, outsider)).rejects.toThrow();
        await expect(service.read(owner, '22222222-2222-4222-8222-222222222222.png', peer)).rejects.toThrow();
        teams.findByMember.mockResolvedValue([]);
        await expect(service.read(owner, version, peer)).rejects.toThrow();
        expect(storage.read).toHaveBeenCalledTimes(2);
    });
    it('validates before storage, ignores the storage URL, commits with compare-and-set, then cleans up', async () => {
        const result = await service.upload(owner, image());
        expect(result.avatarUrl).toMatch(new RegExp(`^/api/profile/${owner}/avatar/`));
        expect(users.replaceAvatar).toHaveBeenCalledWith(owner, oldUrl, result.avatarUrl);
        expect(storage.upload).toHaveBeenCalledWith(
            expect.objectContaining({ objectName: `gadoc/docs/profile-avatar/${owner}/${version}`, size: 0 }),
        );
        expect(events.emit).toHaveBeenCalledWith('profile.updated', { userId: owner });
        expect(users.replaceAvatar.mock.invocationCallOrder[0]).toBeLessThan(
            storage.upload.mock.invocationCallOrder[1],
        );
        await expect(service.upload(owner, { buffer: Buffer.from('<svg/>'), mimetype: 'image/png' })).rejects.toThrow();
        expect(storage.upload).toHaveBeenCalledTimes(2);
    });
    it('keeps the previous profile on upload failure and sanitizes storage exceptions', async () => {
        storage.upload.mockRejectedValue(new Error('secret-storage-token-and-image-content'));
        await expect(service.upload(owner, image())).rejects.toThrow('이미지를 업로드하지 못했습니다.');
        expect(users.replaceAvatar).not.toHaveBeenCalled();
        expect(storage.upload).not.toHaveBeenCalledWith(
            expect.objectContaining({ objectName: `gadoc/docs/profile-avatar/${owner}/${version}` }),
        );
    });
    it('cleans only the uncommitted image after a concurrent replacement conflict', async () => {
        users.replaceAvatar.mockResolvedValue(null);
        await expect(service.upload(owner, image())).rejects.toThrow('다른 곳에서');
        expect(storage.upload).toHaveBeenCalledTimes(2);
        expect(storage.upload).not.toHaveBeenCalledWith(
            expect.objectContaining({ objectName: `gadoc/docs/profile-avatar/${owner}/${version}` }),
        );
        expect(events.emit).not.toHaveBeenCalled();
    });
    it('preserves the current object when a DB write fails, including ambiguous timeouts', async () => {
        users.replaceAvatar.mockRejectedValue(new Error('private db details'));
        await expect(service.upload(owner, image())).rejects.toThrow('프로필을 저장하지 못했습니다.');
        await expect(service.remove(owner)).rejects.toThrow('삭제하지 못했습니다.');
        expect(storage.upload).toHaveBeenCalledTimes(1);
        expect(events.emit).not.toHaveBeenCalled();
    });
    it('revokes the URL before overwriting the old bytes, and makes repeated deletion idempotent', async () => {
        const result = await service.remove(owner);
        expect(result.avatarUrl).toBeNull();
        expect(users.replaceAvatar).toHaveBeenCalledWith(owner, oldUrl, null);
        expect(users.replaceAvatar.mock.invocationCallOrder[0]).toBeLessThan(
            storage.upload.mock.invocationCallOrder[0],
        );
        users.findById.mockResolvedValue(user(null));
        await service.remove(owner);
        await expect(service.read(owner, version, owner)).rejects.toThrow();
        expect(storage.upload).toHaveBeenCalledTimes(1);
    });
    it('keeps a committed deletion revoked when object cleanup is unavailable', async () => {
        storage.upload.mockRejectedValue(new Error('private object-storage details'));
        expect((await service.remove(owner)).avatarUrl).toBeNull();
        expect(storage.upload).toHaveBeenCalledWith(
            expect.objectContaining({ size: 0, mimeType: 'application/octet-stream' }),
        );
    });
});
