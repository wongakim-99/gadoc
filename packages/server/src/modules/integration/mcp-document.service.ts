import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../document/domain/document.port';
import { CreateDocumentUseCase } from '../document/application/use-cases/create-document.use-case';
import { UpdateDocumentUseCase } from '../document/application/use-cases/update-document.use-case';
import { UploadDocumentFileUseCase } from '../document/application/use-cases/upload-document-file.use-case';
import type { McpIdentity } from './integration-token.service';
import { publicAppOrigin } from '../../shared/lib/public-app-origin';

@Injectable()
export class McpDocumentService {
    constructor(
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        private readonly createDocument: CreateDocumentUseCase,
        private readonly updateDocument: UpdateDocumentUseCase,
        private readonly uploadFile: UploadDocumentFileUseCase,
    ) {}

    async requireDocument(identity: McpIdentity, id: string, write = false) {
        const doc = await this.documents.findById(id);
        if (!doc || doc.isArchived || doc.teamId !== identity.teamId || !doc.canView(identity.userId, identity.role)) {
            throw new NotFoundException('문서가 없거나 접근할 수 없습니다.');
        }
        if (write && (identity.role === 'guest' || !doc.canEdit(identity.userId, identity.role))) {
            throw new ForbiddenException('이 문서를 편집할 권한이 없습니다.');
        }
        return doc;
    }

    async list(identity: McpIdentity, input: { query?: string; offset?: number; limit?: number }) {
        const query = input.query?.toLocaleLowerCase() ?? '';
        const docs = (await this.documents.findMetadataByTeam(identity.teamId)).filter(
            (doc) =>
                !doc.isArchived &&
                doc.canView(identity.userId, identity.role) &&
                doc.title.toLocaleLowerCase().includes(query),
        );
        const start = input.offset ?? 0;
        const end = start + (input.limit ?? 50);
        return {
            items: docs.slice(start, end).map((doc) => doc.toTreeNode()),
            nextOffset: end < docs.length ? end : null,
        };
    }

    async get(identity: McpIdentity, documentId: string) {
        const doc = await this.requireDocument(identity, documentId);
        return { ...doc.toPublic(), url: `${publicAppOrigin()}/${identity.teamId}/docs/${doc.id}` };
    }

    async create(
        identity: McpIdentity,
        input: { title: string; content?: string; contentFormat?: 'plain' | 'html' | 'json'; parentId?: string },
    ) {
        const parent = input.parentId ? await this.requireDocument(identity, input.parentId, true) : null;
        this.validateContent(input.content ?? '', input.contentFormat ?? 'plain');
        const doc = await this.createDocument.execute({
            teamId: identity.teamId,
            createdBy: identity.userId,
            title: input.title,
            content: input.content ?? '',
            contentFormat: input.contentFormat ?? 'plain',
            parentId: parent?.id ?? null,
            ...(parent
                ? {
                      visibility: parent.visibility,
                      editPolicy: parent.editPolicy,
                      allowedViewerIds: parent.allowedViewerIds,
                      allowedEditorIds: parent.allowedEditorIds,
                  }
                : {}),
        });
        return { ...doc.toPublic(), url: `${publicAppOrigin()}/${identity.teamId}/docs/${doc.id}` };
    }

    async update(
        identity: McpIdentity,
        input: {
            documentId: string;
            title?: string;
            content?: string;
            contentFormat?: 'plain' | 'html' | 'json';
            expectedUpdatedAt: string;
        },
    ) {
        const current = await this.requireDocument(identity, input.documentId, true);
        if (input.content !== undefined || input.contentFormat !== undefined) {
            this.validateContent(input.content ?? current.content, input.contentFormat ?? current.contentFormat);
        }
        const { documentId, ...changes } = input;
        const doc = await this.updateDocument.execute({ ...changes, id: documentId, updatedBy: identity.userId });
        return doc.toPublic();
    }

    async upload(
        identity: McpIdentity,
        input: { documentId: string; filename: string; mimeType: string; base64: string },
    ) {
        await this.requireDocument(identity, input.documentId, true);
        const buffer = Buffer.from(input.base64, 'base64');
        if (!buffer.length || buffer.length > 2 * 1024 * 1024 || buffer.toString('base64') !== input.base64) {
            throw new BadRequestException(
                'MCP 첨부는 올바른 base64 형식의 2MB 이하 파일이어야 합니다. 큰 파일은 문서에서 첨부해 주세요.',
            );
        }
        return this.uploadFile.execute({
            teamId: identity.teamId,
            documentId: input.documentId,
            file: { buffer, originalname: input.filename, mimetype: input.mimeType, size: buffer.length },
        });
    }

    private validateContent(content: string, format: string) {
        if (format !== 'json') return;
        try {
            const blocks: unknown = JSON.parse(content);
            if (!Array.isArray(blocks) || blocks.length > 5000) throw new Error();
        } catch {
            throw new BadRequestException('JSON 문서는 블록 배열이어야 합니다.');
        }
    }
}
