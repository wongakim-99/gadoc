import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { TeamAccessService } from '../team/application/services/team-access.service';
import { MessageAccessService } from '../message/application/services/message-access.service';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../document/domain/document.port';
import { LegacyFileBindingsService } from './legacy-file-bindings.service';

export function parseStorageKey(value: unknown) {
    if (typeof value !== 'string' || value.length > 2048 || !/^[a-zA-Z0-9._/-]+$/.test(value))
        throw new BadRequestException('파일 경로가 올바르지 않습니다.');
    const parts = value.split('/');
    if (
        parts.some((part) => !part || part === '.' || part === '..') ||
        !['gadoc', 'slacord'].includes(parts[0]) ||
        !['chat', 'docs'].includes(parts[1])
    )
        throw new BadRequestException('파일 경로가 올바르지 않습니다.');
    if (parts[1] === 'chat' && parts.length !== 7) throw new BadRequestException('파일 경로가 올바르지 않습니다.');
    if (
        parts[1] === 'docs' &&
        !((parts[3] === 'doc' && parts.length === 7) || (parts[3] === 'inline' && parts.length === 6))
    )
        throw new BadRequestException('파일 경로가 올바르지 않습니다.');
    return { key: value, parts, teamId: parts[2] };
}

@Injectable()
export class FileAccessService {
    constructor(
        private readonly teams: TeamAccessService,
        private readonly messages: MessageAccessService,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        private readonly legacy: LegacyFileBindingsService,
    ) {}

    async authorize(value: unknown, userId: string) {
        const { key, parts, teamId } = parseStorageKey(value);
        const access = await this.teams.requireMember(teamId, userId);
        if (parts[1] === 'chat') {
            const { channel } = await this.messages.ensureChannelMember(parts[3], userId);
            if (channel.teamId !== teamId) throw new ForbiddenException('파일 접근 권한이 없습니다.');
        } else if (parts[3] === 'doc') {
            const doc = await this.documents.findById(parts[4]);
            if (!doc || doc.teamId !== teamId || !doc.canView(userId, access.role))
                throw new ForbiddenException('파일 접근 권한이 없습니다.');
        } else {
            // Immutable migration bindings survive copied links and deleted source documents.
            const documentIds = await this.legacy.documentIds(key, teamId);
            if (!documentIds.length) throw new ForbiddenException('파일이 연결된 문서를 볼 권한이 없습니다.');
            for (const id of documentIds) {
                const doc = await this.documents.findById(id);
                if (!doc || doc.teamId !== teamId || !doc.canView(userId, access.role))
                    throw new ForbiddenException('파일이 연결된 문서를 볼 권한이 없습니다.');
            }
        }
        return key;
    }
}
