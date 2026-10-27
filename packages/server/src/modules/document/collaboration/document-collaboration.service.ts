import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { Doc } from '../infrastructure/persistence/document.schema';
import { DOCUMENT_REPOSITORY, type IDocumentRepository } from '../domain/document.port';
import { DOCUMENT_VERSION_REPOSITORY, type IDocumentVersionRepository } from '../domain/document-version.port';
import { TeamAccessService } from '../../team/application/services/team-access.service';
import { DocumentCodec, documentStateBytes } from './document-codec';

export const DOCUMENT_SYNC = 'document.collaboration.changed';
type DocumentChanges = Parameters<IDocumentRepository['update']>[1];

@Injectable()
export class DocumentCollaborationService {
    private readonly queues = new Map<string, Promise<unknown>>();
    private readonly codec = new DocumentCodec();
    constructor(
        @InjectModel(Doc.name) private readonly model: Model<Doc>,
        @Inject(DOCUMENT_REPOSITORY) private readonly documents: IDocumentRepository,
        @Inject(DOCUMENT_VERSION_REPOSITORY) private readonly versions: IDocumentVersionRepository,
        private readonly teams: TeamAccessService,
        private readonly events: EventEmitter2,
    ) {}

    private async serial<T>(id: string, action: () => Promise<T>): Promise<T> {
        const previous = this.queues.get(id) ?? Promise.resolve();
        const next = previous.catch(() => {}).then(action);
        this.queues.set(id, next);
        try {
            return await next;
        } finally {
            if (this.queues.get(id) === next) this.queues.delete(id);
        }
    }
    async authorize(teamId: string, documentId: string, userId: string, write = false) {
        if (!/^[a-f0-9]{24}$/.test(teamId) || !/^[a-f0-9]{24}$/.test(documentId))
            throw new NotFoundException('문서를 찾을 수 없습니다.');
        const { role } = await this.teams.requireMember(teamId, userId);
        const doc = await this.documents.findById(documentId);
        if (!doc || doc.teamId !== teamId || doc.isArchived || !doc.canView(userId, role))
            throw new NotFoundException('문서에 접근할 수 없습니다.');
        const canEdit = role !== 'guest' && doc.canEdit(userId, role);
        if (write && !canEdit) throw new ForbiddenException('문서를 편집할 권한이 없습니다.');
        return { doc, canEdit };
    }
    async snapshot(teamId: string, documentId: string, userId: string) {
        return this.serial(documentId, async () => {
            const { doc, canEdit } = await this.authorize(teamId, documentId, userId);
            const stored = await this.model.findById(documentId).select('+collaborationState').lean();
            if (!stored) throw new NotFoundException();
            const snapshot = await this.codec.process({ ...stored, state: stored.collaborationState });
            if (!stored.collaborationState) {
                const result = await this.model.updateOne(
                    { _id: documentId, updatedAt: stored.updatedAt },
                    { $set: { collaborationState: snapshot.state, content: snapshot.content, contentFormat: 'json' } },
                    { timestamps: false },
                );
                if (!result.modifiedCount) throw new ConflictException('문서가 변경되었습니다. 다시 연결해 주세요.');
            }
            return { update: snapshot.state, canEdit, title: doc.title, updatedAt: stored.updatedAt.toISOString() };
        });
    }
    async apply(teamId: string, documentId: string, userId: string, update: Uint8Array) {
        if (!(update instanceof Uint8Array) || !update.byteLength || update.byteLength > 256 * 1024)
            throw new BadRequestException('편집 변경의 크기를 확인해 주세요.');
        return this.serial(documentId, async () => {
            await this.authorize(teamId, documentId, userId, true);
            for (let attempt = 0; attempt < 3; attempt++) {
                const current = await this.model
                    .findById(documentId)
                    .select('+collaborationState +collaborationCheckpointAt')
                    .lean();
                if (!current?.collaborationState) throw new ConflictException('문서에 다시 연결해 주세요.');
                const next = await this.codec.process({ ...current, state: current.collaborationState, update });
                if (next.state.equals(documentStateBytes(current.collaborationState)!))
                    return { updatedAt: current.updatedAt.toISOString() };
                const checkpoint =
                    !current.collaborationCheckpointAt ||
                    Date.now() - current.collaborationCheckpointAt.getTime() > 30_000;
                if (checkpoint)
                    await this.versions.save({
                        documentId,
                        teamId,
                        title: current.title,
                        content: current.content,
                        contentFormat: current.contentFormat,
                        savedBy: userId,
                    });
                const saved = await this.model
                    .findOneAndUpdate(
                        { _id: documentId, teamId, updatedAt: current.updatedAt, archivedAt: null },
                        {
                            $set: {
                                collaborationState: next.state,
                                content: next.content,
                                contentFormat: 'json',
                                updatedBy: userId,
                                ...(checkpoint ? { collaborationCheckpointAt: new Date() } : {}),
                            },
                        },
                        { returnDocument: 'after' },
                    )
                    .lean();
                if (!saved) continue;
                this.events.emit(DOCUMENT_SYNC, {
                    teamId,
                    documentId,
                    update: next.delta,
                    title: saved.title,
                    updatedAt: saved.updatedAt.toISOString(),
                });
                return { updatedAt: saved.updatedAt.toISOString() };
            }
            throw new ConflictException('편집 요청이 겹쳤습니다. 변경을 유지한 채 다시 시도해 주세요.');
        });
    }
    async updateSnapshot(documentId: string, changes: DocumentChanges, expectedUpdatedAt?: Date) {
        return this.serial(documentId, async () => {
            const current = await this.model.findById(documentId).select('+collaborationState').lean();
            if (!current) return null;
            if (expectedUpdatedAt && +current.updatedAt !== +expectedUpdatedAt) return null;
            if (current.collaborationState && changes.content !== undefined && !expectedUpdatedAt) {
                throw new ConflictException(
                    '공동 편집 중인 문서입니다. 최신 문서를 읽고 expectedUpdatedAt과 함께 수정해 주세요.',
                );
            }
            if (!current.collaborationState || (changes.content === undefined && changes.contentFormat === undefined)) {
                const saved = await this.documents.update(documentId, changes, expectedUpdatedAt);
                if (saved)
                    this.events.emit(DOCUMENT_SYNC, {
                        teamId: saved.teamId,
                        documentId,
                        title: saved.title,
                        updatedAt: saved.updatedAt.toISOString(),
                    });
                return saved;
            }
            const next = await this.codec.process({
                ...current,
                state: current.collaborationState,
                replacement: {
                    content: changes.content ?? current.content,
                    contentFormat: changes.contentFormat ?? current.contentFormat,
                },
            });
            const saved = await this.model
                .findOneAndUpdate(
                    { _id: documentId, updatedAt: current.updatedAt, archivedAt: null },
                    {
                        $set: {
                            ...changes,
                            content: next.content,
                            contentFormat: 'json',
                            collaborationState: next.state,
                        },
                    },
                    { returnDocument: 'after' },
                )
                .lean();
            if (!saved) return null;
            this.events.emit(DOCUMENT_SYNC, {
                teamId: saved.teamId,
                documentId,
                update: next.delta,
                title: saved.title,
                updatedAt: saved.updatedAt.toISOString(),
            });
            return this.documents.findById(documentId);
        });
    }
}
