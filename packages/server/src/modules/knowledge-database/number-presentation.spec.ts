import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddPropertyDto } from './database.dto';

describe('numeric presentation configuration', () => {
    const make = (overrides: Record<string, unknown>) => plainToInstance(AddPropertyDto, {
        name: 'Progress', type: 'number', revision: 0,
        numberPresentation: { display: 'bar', divideBy: 100, color: 'blue', showNumber: true, ...overrides },
    });
    it('accepts fractional scales and explicit hidden labels', async () => {
        expect(await validate(make({ divideBy: 1, display: 'ring', showNumber: false }))).toEqual([]);
    });
    it.each([0, -1, NaN, Infinity, '100'])('rejects invalid divisor %s', async (divideBy) => {
        expect(await validate(make({ divideBy }))).not.toEqual([]);
    });
    it('rejects arbitrary color/style and unknown presentation', async () => {
        expect(await validate(make({ color: 'url(https://example.com)' }))).not.toEqual([]);
        expect(await validate(make({ display: 'animation' }))).not.toEqual([]);
        expect(await validate(make({ showNumber: 'false' }))).not.toEqual([]);
    });
});
