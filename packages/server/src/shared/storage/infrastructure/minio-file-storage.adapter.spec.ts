import { ConfigService } from '@nestjs/config';
import { MinioFileStorageAdapter, storageCredentials } from './minio-file-storage.adapter';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

describe('original filename metadata', () => {
    it('persists ASCII-safe metadata and restores it for reads, including empty files', async () => {
        const adapter = new MinioFileStorageAdapter(new ConfigService({ MINIO_PREPROVISIONED: '1' }));
        const name = '한글_日本語_😀_100%20.txt';
        let metadata: Record<string, string> | undefined;
        let size = 2;
        const send = jest.fn(async (command: any) => {
            if (command instanceof PutObjectCommand) {
                metadata = command.input.Metadata;
                return {};
            }
            if (command instanceof HeadObjectCommand)
                return { ContentLength: size, Metadata: metadata, ContentType: 'text/plain' };
            if (
                command instanceof GetObjectCommand &&
                command.input.Range === 'bytes=0-1' &&
                send.mock.calls.length === 3
            )
                return { Body: { transformToByteArray: async () => Buffer.from('ok') } };
            return { Body: Readable.from(['ok']) };
        });
        (adapter as unknown as { client: { send: typeof send } }).client.send = send;
        await adapter.upload({
            buffer: Buffer.from('ok'),
            objectName: 'test/ascii.txt',
            originalName: name,
            mimeType: 'text/plain',
            size,
        });
        expect(metadata).toEqual({ 'filename-utf8': encodeURIComponent(name) });
        expect((await adapter.read('test/ascii.txt')).originalName).toBe(name);
        size = 0;
        expect((await adapter.read('test/ascii.txt')).originalName).toBe(name);
    });
});

describe('storage credentials', () => {
    it('fails closed in production without a dedicated account', () => {
        for (const values of [
            {},
            { MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'changed-root-secret' },
            { MINIO_ACCESS_KEY: 'gadoc-app', MINIO_SECRET_KEY: 'minioadmin' },
        ]) {
            const config = new ConfigService(values);
            jest.spyOn(config, 'get').mockImplementation((key) => (values as Record<string, string>)[String(key)]);
            expect(() => storageCredentials(config, true)).toThrow();
        }
        expect(
            storageCredentials(
                new ConfigService({ MINIO_ACCESS_KEY: 'gadoc-app', MINIO_SECRET_KEY: 'private-test-secret' }),
                true,
            ),
        ).toEqual({ accessKeyId: 'gadoc-app', secretAccessKey: 'private-test-secret' });
    });
});
