import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { safeUploadContent } from './upload-content';
import { byteRange } from './byte-range';
import { IFileStorage, StoredFile, UploadBinaryInput } from '../domain/file-storage.port';

export function storageCredentials(config: ConfigService, production = process.env.NODE_ENV === 'production') {
    const accessKeyId = config.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = config.get<string>('MINIO_SECRET_KEY');
    if (
        production &&
        (!accessKeyId || !secretAccessKey || accessKeyId === 'minioadmin' || secretAccessKey === 'minioadmin')
    ) {
        throw new Error('Dedicated MinIO application credentials are required in production.');
    }
    return { accessKeyId: accessKeyId ?? 'minioadmin', secretAccessKey: secretAccessKey ?? 'minioadmin' };
}

@Injectable()
export class MinioFileStorageAdapter implements IFileStorage {
    private readonly logger = new Logger(MinioFileStorageAdapter.name);
    private readonly bucket: string;
    private readonly client: S3Client;
    private bucketReady: Promise<void> | null = null;

    constructor(config: ConfigService) {
        this.bucket = config.get<string>('MINIO_BUCKET') ?? 'slacord';
        this.client = new S3Client({
            endpoint: config.get<string>('MINIO_ENDPOINT') ?? 'http://host.docker.internal:9000',
            region: 'us-east-1',
            forcePathStyle: true,
            credentials: storageCredentials(config),
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
            requestHandler: { connectionTimeout: 3000, requestTimeout: 15000 },
        });
    }

    async upload(input: UploadBinaryInput): Promise<StoredFile> {
        await this.ensureBucket();
        const content = safeUploadContent(input.buffer, input.mimeType);
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: input.objectName,
                Body: input.buffer,
                ContentLength: input.size,
                ContentType: content.mimeType,
                ContentDisposition: content.disposition,
            }),
        );
        return {
            key: input.objectName,
            url: `/api/files?key=${encodeURIComponent(input.objectName)}`,
            mimeType: content.mimeType,
            size: input.size,
        };
    }

    async read(key: string, requestedRange?: string) {
        let stat;
        try {
            stat = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        } catch (error) {
            if (['NoSuchKey', 'NotFound'].includes((error as Error).name))
                throw new NotFoundException('파일을 찾을 수 없습니다.');
            throw error;
        }
        const size = stat.ContentLength ?? 0;
        const range = byteRange(requestedRange, size);
        if (!size) return { stream: Readable.from([]), size, ...range, ...safeUploadContent(Buffer.alloc(0), '') };
        const probe = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Range: `bytes=0-${Math.min(511, size - 1)}`,
            }),
        );
        if (!probe.Body) throw new NotFoundException('파일을 찾을 수 없습니다.');
        const content = safeUploadContent(Buffer.from(await probe.Body.transformToByteArray()), stat.ContentType ?? '');
        const file = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Range: `bytes=${range.start}-${range.end}`,
            }),
        );
        if (!(file.Body instanceof Readable)) throw new Error('Storage did not return a file stream.');
        return { stream: file.Body, size, ...range, ...content };
    }

    private ensureBucket() {
        // Production buckets are pre-provisioned. The app never needs ListBucket/CreateBucket/PutBucketPolicy.
        if (process.env.NODE_ENV === 'production') return Promise.resolve();
        if (!this.bucketReady) {
            this.bucketReady = this.prepareDevelopmentBucket().catch((error) => {
                this.bucketReady = null;
                throw error;
            });
        }
        return this.bucketReady;
    }

    private async prepareDevelopmentBucket() {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (error) {
            if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
            this.logger.log(`Created test/development bucket: ${this.bucket}`);
        }
    }
}
