import { mongo } from 'mongoose';
import { documentStateBytes } from './document-codec';

describe('persisted collaboration binary', () => {
    it('normalizes lean BSON and Mongoose Buffer without copying unused capacity', () => {
        const bytes = Buffer.from([1, 2, 3]);
        expect(documentStateBytes(bytes)).toEqual(bytes);
        expect(documentStateBytes(new mongo.Binary(bytes))).toEqual(bytes);
        expect(documentStateBytes({ buffer: Buffer.from([1, 2, 3, 0, 0]), position: 3 })).toEqual(bytes);
        expect(documentStateBytes(undefined)).toBeUndefined();
        expect(() => documentStateBytes('invalid')).toThrow();
    });
});
