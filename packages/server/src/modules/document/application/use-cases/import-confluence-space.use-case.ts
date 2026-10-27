import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../../domain/document.port';
import { ConfluenceApiClient } from '../../infrastructure/external/confluence-api.client';
import { confluenceStorageToHtml } from '../../infrastructure/external/confluence-storage-to-text';
import { DocumentCollaborationService } from '../../collaboration/document-collaboration.service';

interface ImportInput {
    teamId: string;
    requestedBy: string;
    siteUrl: string;
    email: string;
    apiToken: string;
    spaceKey: string;
    rootPageId?: string;
}

@Injectable()
export class ImportConfluenceSpaceUseCase {
    constructor(
        @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
        private readonly confluenceClient: ConfluenceApiClient,
        private readonly collaboration: DocumentCollaborationService,
    ) {}

    async execute(input: ImportInput) {
        const pages = await this.confluenceClient.getSpacePages(input);
        const filtered = filterPages(pages, input.rootPageId);
        const ordered = [...filtered].sort((left, right) => depthOf(filtered, left.id) - depthOf(filtered, right.id));
        const docIdByPageId = new Map<string, string>();
        const existing = new Map(
            (await this.repo.findMetadataByTeam(input.teamId))
                .filter((doc) => doc.externalSource === 'confluence')
                .map((doc) => [doc.externalId, doc]),
        );

        for (const page of ordered) {
            const parentId = page.parentId ? (docIdByPageId.get(page.parentId) ?? null) : null;
            const previous = existing.get(page.id);
            if (previous) {
                await this.collaboration.authorize(input.teamId, previous.id, input.requestedBy, true);
                const updated = await this.collaboration.updateSnapshot(
                    previous.id,
                    {
                        title: page.title,
                        content: confluenceStorageToHtml(page.content),
                        contentFormat: 'html',
                        parentId,
                        updatedBy: input.requestedBy,
                    },
                    previous.updatedAt,
                );
                if (!updated) throw new Error('가져오는 중 문서가 변경되었습니다. 다시 시도해 주세요.');
                docIdByPageId.set(page.id, updated.id);
                continue;
            }
            const doc = await this.repo.upsertExternal({
                teamId: input.teamId,
                title: page.title,
                content: confluenceStorageToHtml(page.content),
                contentFormat: 'html',
                parentId,
                createdBy: input.requestedBy,
                updatedBy: input.requestedBy,
                externalSource: 'confluence',
                externalId: page.id,
                externalUrl: page.url,
            });
            docIdByPageId.set(page.id, doc.id);
        }

        return {
            importedCount: ordered.length,
            rootCount: ordered.filter((page) => !page.parentId || !docIdByPageId.has(page.parentId)).length,
        };
    }
}

function filterPages<T extends { id: string; parentId: string | null }>(pages: T[], rootPageId?: string) {
    if (!rootPageId) return pages;
    const byId = new Map(pages.map((page) => [page.id, page]));
    return pages.filter((page) => {
        let current: T | undefined = page;
        while (current) {
            if (current.id === rootPageId) return true;
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return false;
    });
}

function depthOf<T extends { id: string; parentId: string | null }>(pages: T[], id: string) {
    const byId = new Map(pages.map((page) => [page.id, page]));
    let depth = 0;
    let current = byId.get(id);
    while (current?.parentId && byId.has(current.parentId)) {
        depth += 1;
        current = byId.get(current.parentId);
    }
    return depth;
}
