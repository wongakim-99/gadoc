import { TeamAccessService } from '../../../team/application/services/team-access.service';
import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { IDocumentRepository } from '../../domain/document.port';
import { DOCUMENT_REPOSITORY } from '../../domain/document.port';
import type { DocumentEntity } from '../../domain/document.entity';
import type { IDocumentVersionRepository } from '../../domain/document-version.port';
import { DOCUMENT_VERSION_REPOSITORY } from '../../domain/document-version.port';

@Injectable()
export class CreateDocumentUseCase {
    constructor(
        @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
        @Inject(DOCUMENT_VERSION_REPOSITORY) private readonly versionRepo: IDocumentVersionRepository,
        private readonly access: TeamAccessService,
    ) {}

    async execute(data: {
        id?: string;
        inheritPermissions?: boolean;
        visibility?: 'team' | 'restricted';
        editPolicy?: 'owner_admin' | 'all' | 'restricted';
        allowedViewerIds?: string[];
        allowedEditorIds?: string[];
        teamId: string;
        title: string;
        content: string;
        contentFormat?: 'plain' | 'html' | 'json';
        parentId: string | null;
        createdBy: string;
    }): Promise<DocumentEntity> {
        if (data.parentId) {
            const { role } = await this.access.requireWritableMember(data.teamId, data.createdBy);
            const parent = await this.repo.findById(data.parentId);
            if (!parent || parent.teamId !== data.teamId || parent.isArchived || !parent.canView(data.createdBy, role))
                throw new NotFoundException('상위 페이지를 찾을 수 없습니다.');
            if (!parent.canEdit(data.createdBy, role))
                throw new ForbiddenException('상위 페이지에 하위 페이지를 만들 권한이 없습니다.');
        }
        const doc = await this.repo.save({ ...data, ...(data.parentId ? { inheritPermissions: true } : {}) });
        await this.versionRepo.save({
            documentId: doc.id,
            teamId: doc.teamId,
            title: doc.title,
            content: doc.content,
            contentFormat: doc.contentFormat,
            savedBy: data.createdBy,
        });
        return doc;
    }
}
