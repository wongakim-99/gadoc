import {
    BadRequestException,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AVATAR_MAX_BYTES } from './avatar-image';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
    constructor(private readonly profiles: ProfileService) {}

    @Post('auth/me/avatar')
    @ApiOperation({ summary: '내 프로필 이미지 업로드·교체 (2MiB, 2048×2048 이내)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
    })
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 1 } }))
    upload(@CurrentUser() user: { userId: string }, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
        if (!file?.buffer) throw new BadRequestException('업로드할 이미지가 필요합니다.');
        return this.profiles.upload(user.userId, file);
    }

    @Delete('auth/me/avatar')
    @ApiOperation({ summary: '내 프로필 이미지 삭제' })
    remove(@CurrentUser() user: { userId: string }) {
        return this.profiles.remove(user.userId);
    }

    @Get('profile/:userId')
    @ApiOperation({ summary: '본인 또는 같은 워크스페이스 멤버의 현재 공개 identity 조회 (이메일 제외)' })
    identity(@Param('userId') targetId: string, @CurrentUser() user: { userId: string }) {
        return this.profiles.identity(targetId, user.userId);
    }

    @Get('profile/:userId/avatar/:version')
    @ApiOperation({ summary: '현재 프로필 이미지 제공 (매 요청 본인·공유 워크스페이스 ACL 검사)' })
    async image(
        @Param('userId') targetId: string,
        @Param('version') version: string,
        @CurrentUser() user: { userId: string },
        @Res() res: Response,
    ) {
        const file = await this.profiles.read(targetId, version, user.userId);
        res.set({
            'Content-Type': file.mimeType,
            'Content-Length': String(file.size),
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        });
        try {
            await pipeline(file.stream, res);
        } catch {
            if (!res.destroyed) res.destroy();
        }
    }
}
