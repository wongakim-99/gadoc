import { ConfigService } from '@nestjs/config';
import { storageCredentials } from './minio-file-storage.adapter';

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
