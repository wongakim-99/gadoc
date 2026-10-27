import { Controller, Get, Headers, Inject, Query, Res, UseGuards } from '@nestjs/common';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { FILE_STORAGE, type IFileStorage } from '../../shared/storage/domain/file-storage.port';
import { FileAccessService } from './file-access.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
    constructor(
        private readonly access: FileAccessService,
        @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    ) {}

    @Get()
    async download(
        @Query('key') key: unknown,
        @CurrentUser() user: { userId: string },
        @Headers('range') range: string | undefined,
        @Res() res: Response,
    ) {
        const authorizedKey = await this.access.authorize(key, user.userId);
        const file = await this.storage.read(authorizedKey, range);
        res.status(file.partial ? 206 : 200);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Length', file.end - file.start + 1);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader(
            'Content-Disposition',
            `${file.disposition}; filename*=UTF-8''${encodeURIComponent(authorizedKey.split('/').at(-1)!)}`,
        );
        if (file.partial) res.setHeader('Content-Range', `bytes ${file.start}-${file.end}/${file.size}`);
        try {
            await pipeline(file.stream, res);
        } catch {
            if (!res.destroyed) res.destroy();
        }
    }
}
