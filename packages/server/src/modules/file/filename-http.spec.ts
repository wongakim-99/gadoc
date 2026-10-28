import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'node:stream';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { FILE_STORAGE } from '../../shared/storage/domain/file-storage.port';
import { CLOCK } from '../../shared/lib/clock';
import { MessageUploadController } from '../message/infrastructure/http/message-upload.controller';
import { UploadMessageAttachmentUseCase } from '../message/application/use-cases/upload-message-attachment.use-case';
import { MessageAccessService } from '../message/application/services/message-access.service';
import { DocumentUploadController } from '../document/infrastructure/http/document-upload.controller';
import { UploadDocumentFileUseCase } from '../document/application/use-cases/upload-document-file.use-case';
import { GetDocumentsUseCase } from '../document/application/use-cases/get-documents.use-case';
import { FileController } from './file.controller';
import { FileAccessService } from './file-access.service';

describe('filename HTTP transport', () => {
    let app: INestApplication;
    let originalName: string | undefined;
    const upload = jest.fn(async (input) => {
        originalName = input.originalName;
        return { key: input.objectName, url: '/files?key=test', mimeType: 'text/plain', size: 2 };
    });
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [MessageUploadController, DocumentUploadController, FileController],
            providers: [
                UploadMessageAttachmentUseCase,
                UploadDocumentFileUseCase,
                { provide: CLOCK, useValue: { now: () => new Date('2026-10-28') } },
                {
                    provide: MessageAccessService,
                    useValue: { ensureChannelWriter: async () => ({ channel: { teamId: 'team' } }) },
                },
                {
                    provide: GetDocumentsUseCase,
                    useValue: {
                        executeOne: async () => ({ teamId: 'team', canView: () => true, canEdit: () => true }),
                    },
                },
                { provide: FileAccessService, useValue: { authorize: async () => 'gadoc/test/legacy.txt' } },
                {
                    provide: FILE_STORAGE,
                    useValue: {
                        upload,
                        read: async () => ({
                            originalName,
                            stream: Readable.from(['ok']),
                            mimeType: 'text/plain',
                            disposition: 'attachment',
                            size: 2,
                            start: 0,
                            end: 1,
                            partial: false,
                        }),
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (ctx: any) => {
                    const req = ctx.switchToHttp().getRequest();
                    req.user = { userId: 'user' };
                    req.teamAccess = { role: 'owner' };
                    return true;
                },
            })
            .compile();
        app = module.createNestApplication();
        await app.init();
    });
    afterAll(async () => {
        await app?.close();
    });

    it.each(['한글 파일.txt', 'Q4_한글_日本語_😀_café.txt', 'report.txt', 'café.txt', 'Ã©.txt'])(
        'round-trips multipart and download: %s',
        async (name) => {
            const body = Buffer.from(
                `--test\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\nok\r\n--test--\r\n`,
            );
            const response = await request(app.getHttpServer())
                .post('/channel/channel/message/attachment')
                .set('Content-Type', 'multipart/form-data; boundary=test')
                .send(body)
                .expect(201);
            const expected = name;
            expect(response.body.data.name).toBe(expected);
            expect(upload.mock.calls.at(-1)?.[0].originalName).toBe(expected);
            const downloaded = await request(app.getHttpServer()).get('/files?key=test').expect(200);
            expect(decodeURIComponent(downloaded.headers['content-disposition'].split("UTF-8''")[1])).toBe(expected);
            expect(downloaded.text).toBe('ok');
        },
    );

    it('round-trips document uploads through the same UTF-8 parser', async () => {
        const name = '??_???_??_caf?.txt';
        const response = await request(app.getHttpServer())
            .post('/team/team/document/doc/file')
            .attach('file', Buffer.from('ok'), { filename: name, contentType: 'text/plain' })
            .expect(201);
        expect(response.body.name).toBe(name);
        expect(upload.mock.calls.at(-1)?.[0].originalName).toBe(name);
    });

    it('preserves already decoded filename* and does not double decode it', async () => {
        const name = '한글_😀_Ã©.txt';
        const body = Buffer.from(
            `--test\r\nContent-Disposition: form-data; name="file"; filename*=UTF-8''${encodeURIComponent(name)}\r\nContent-Type: text/plain\r\n\r\nok\r\n--test--\r\n`,
        );
        const response = await request(app.getHttpServer())
            .post('/channel/channel/message/attachment')
            .set('Content-Type', 'multipart/form-data; boundary=test')
            .send(body)
            .expect(201);
        expect(response.body.data.name).toBe(name);
    });

    it('keeps the legacy key fallback when no original-name metadata exists', async () => {
        originalName = undefined;
        const response = await request(app.getHttpServer()).get('/files?key=test').expect(200);
        expect(response.headers['content-disposition']).toContain("filename*=UTF-8''legacy.txt");
    });
});
