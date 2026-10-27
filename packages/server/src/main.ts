import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { corsOrigin } from './shared/lib/security-config';
import { securityMiddleware } from './shared/http/security.middleware';
import cookieParser from 'cookie-parser';
import { json, type Request, type Response, type NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpLoggingInterceptor } from './shared/interceptors/http-logging.interceptor';
import { DiscordErrorFilter } from './shared/filters/discord-error.filter';
import { DiscordNotifyService } from './modules/discord/discord-notify.service';

/**
 * Slacord 서버
 * - 팀 올인원 협업 툴 백엔드 (순수 MongoDB 저장 방식)
 * - REST API + Socket.IO WebSocket
 */
async function bootstrap() {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule, { rawBody: true });

    app.use(cookieParser());
    app.use(securityMiddleware);
    const mcpBody = json({ limit: '3mb' });
    // Nest detects parser middleware by name. A route-specific jsonParser must
    // not make it skip the default parser used by login, documents and webhooks.
    app.use('/api/mcp', (req: Request, res: Response, next: NextFunction) => mcpBody(req, res, next));
    app.useGlobalInterceptors(new HttpLoggingInterceptor());
    app.useGlobalFilters(new DiscordErrorFilter(app.get(DiscordNotifyService)));

    app.enableCors({
        origin: corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id'],
    });

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );

    // Swagger 문서
    const config = new DocumentBuilder()
        .setTitle('GaDoc API')
        .setDescription('팀 올인원 협업 툴 API')
        .setVersion('1.0')
        .addBearerAuth(undefined, 'JWT-Auth')
        .build();
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
    }

    const host = process.env.HOST ?? '0.0.0.0';
    const port = process.env.PORT ?? 8082;
    await app.listen(port, host);

    logger.log(`Server running on http://${host}:${port}`);
    logger.log(`Swagger docs: http://${host}:${port}/api/docs`);
}

bootstrap().catch((err) => {
    new Logger('Bootstrap').error('서버 시작 실패:', err);
    process.exit(1);
});
