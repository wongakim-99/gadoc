import {
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { USER_REPOSITORY, type IUserRepository } from '../auth/domain/auth.port';
import { TEAM_REPOSITORY, type ITeamRepository } from '../team/domain/team.port';
import { FILE_STORAGE, type IFileStorage } from '../../shared/storage/domain/file-storage.port';
import { validateAvatarImage } from './avatar-image';

const objectId = /^[a-f0-9]{24}$/;
const versionPattern = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;
export const profileAvatarUrl = (userId: string, version: string) => `/api/profile/${userId}/avatar/${version}`;
const keyFor = (userId: string, version: string) => `gadoc/docs/profile-avatar/${userId}/${version}`;

@Injectable()
export class ProfileService {
    private readonly logger = new Logger(ProfileService.name);

    constructor(
        @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
        @Inject(TEAM_REPOSITORY) private readonly teams: ITeamRepository,
        @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
        private readonly events: EventEmitter2,
    ) {}

    async identity(targetId: string, viewerId: string) {
        return (await this.authorize(targetId, viewerId)).toIdentity();
    }

    async upload(userId: string, file: { buffer: Buffer; mimetype: string }) {
        const image = validateAvatarImage(file.buffer, file.mimetype);
        const current = await this.authorize(userId, userId);
        const version = `${randomUUID()}.${image.extension}`;
        const key = keyFor(userId, version);
        const url = profileAvatarUrl(userId, version);
        try {
            await this.storage.upload({
                buffer: file.buffer,
                objectName: key,
                mimeType: image.mimeType,
                size: file.buffer.length,
            });
        } catch {
            // An interrupted PutObject can have completed; the generated key belongs to this request only.
            await this.cleanup(key);
            throw new ServiceUnavailableException(
                '이미지를 업로드하지 못했습니다. 선택한 이미지로 다시 시도해 주세요.',
            );
        }
        let updated;
        try {
            updated = await this.users.replaceAvatar(userId, current.avatarUrl, url);
        } catch {
            // A database timeout can have committed. Do not delete a possibly current image.
            throw new ServiceUnavailableException('프로필을 저장하지 못했습니다. 다시 시도해 주세요.');
        }
        if (!updated) {
            await this.cleanup(key);
            throw new ConflictException('다른 곳에서 프로필 이미지가 변경되었습니다. 확인 후 다시 시도해 주세요.');
        }
        this.events.emit('profile.updated', { userId });
        await this.cleanupPrevious(userId, current.avatarUrl);
        return updated.toIdentity();
    }

    async remove(userId: string) {
        const current = await this.authorize(userId, userId);
        if (!current.avatarUrl) return current.toIdentity();
        let updated;
        try {
            updated = await this.users.replaceAvatar(userId, current.avatarUrl, null);
        } catch {
            throw new ServiceUnavailableException('프로필 이미지를 삭제하지 못했습니다. 다시 시도해 주세요.');
        }
        if (!updated)
            throw new ConflictException('다른 곳에서 프로필 이미지가 변경되었습니다. 확인 후 다시 시도해 주세요.');
        this.events.emit('profile.updated', { userId });
        // Commit revocation first. Object cleanup cannot leave a current profile pointing at a deleted object.
        await this.cleanupPrevious(userId, current.avatarUrl);
        return updated.toIdentity();
    }

    async read(targetId: string, version: string, viewerId: string) {
        if (!versionPattern.test(version)) throw new NotFoundException('프로필 이미지를 찾을 수 없습니다.');
        const user = await this.authorize(targetId, viewerId);
        if (user.avatarUrl !== profileAvatarUrl(targetId, version))
            throw new NotFoundException('프로필 이미지를 찾을 수 없습니다.');
        try {
            return await this.storage.read(keyFor(targetId, version));
        } catch {
            throw new NotFoundException('프로필 이미지를 불러오지 못했습니다.');
        }
    }

    private async authorize(targetId: string, viewerId: string) {
        if (!objectId.test(targetId) || !objectId.test(viewerId))
            throw new NotFoundException('프로필을 찾을 수 없습니다.');
        if (targetId !== viewerId) {
            const teams = await this.teams.findByMember(viewerId);
            if (!teams.some((team) => team.isMember(targetId)))
                throw new NotFoundException('프로필을 찾을 수 없습니다.');
        }
        const user = await this.users.findById(targetId);
        if (!user) throw new NotFoundException('프로필을 찾을 수 없습니다.');
        return user;
    }

    private async cleanupPrevious(userId: string, url: string | null) {
        const prefix = `/api/profile/${userId}/avatar/`;
        const version = url?.startsWith(prefix) ? url.slice(prefix.length) : '';
        if (versionPattern.test(version)) await this.cleanup(keyFor(userId, version));
    }

    private async cleanup(key: string) {
        // Existing app credentials permit Get/Put on docs/*, not DeleteObject.
        // Clear only this managed object after revocation without widening storage privileges.
        try {
            await this.storage.upload({
                buffer: Buffer.alloc(0),
                objectName: key,
                mimeType: 'application/octet-stream',
                size: 0,
            });
        } catch {
            this.logger.warn('프로필 이미지 객체 정리에 실패했습니다. 접근 권한은 현재 프로필로 검사합니다.');
        }
    }
}
