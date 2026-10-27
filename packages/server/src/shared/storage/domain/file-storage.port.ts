import type { Readable } from 'node:stream';

export interface UploadBinaryInput {
    buffer: Buffer;
    objectName: string;
    mimeType: string;
    size: number;
}

export interface StoredFile {
    key: string;
    url: string;
    mimeType: string;
    size: number;
}

export interface PrivateFile {
    stream: Readable;
    mimeType: string;
    disposition: string;
    size: number;
    start: number;
    end: number;
    partial: boolean;
}

export interface IFileStorage {
    read(key: string, range?: string): Promise<PrivateFile>;
    upload(input: UploadBinaryInput): Promise<StoredFile>;
}

export const FILE_STORAGE = Symbol('IFileStorage');
