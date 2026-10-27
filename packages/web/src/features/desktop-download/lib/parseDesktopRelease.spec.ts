import { describe, expect, it } from 'vitest';
import { parseDesktopRelease } from './parseDesktopRelease';

const name = 'Slacord-1.0.9-x64.exe';
const asset = {
    name,
    state: 'uploaded',
    size: 100,
    browser_download_url: `https://github.com/kscold/gadoc/releases/download/v1.0.9/${name}`,
};
const release = { tag_name: 'v1.0.9', draft: false, prerelease: false, assets: [asset] };

describe('published desktop installers', () => {
    it('uses the published version and only existing platform assets', () => {
        expect(parseDesktopRelease(release)).toEqual({
            version: '1.0.9',
            assets: [{ name, href: asset.browser_download_url }],
        });
    });
    it('accepts GaDoc installers while keeping legacy published assets', () => {
        const newName = 'GaDoc-1.0.9-x64.exe';
        const renamed = {
            ...asset,
            name: newName,
            browser_download_url: asset.browser_download_url.replace(name, newName),
        };
        expect(parseDesktopRelease({ ...release, assets: [renamed] })?.assets[0].name).toBe(newName);
    });
    it.each([null, {}, { ...release, draft: true }, { ...release, prerelease: true }, { ...release, assets: [] }])(
        'rejects unavailable releases',
        (value) => {
            expect(parseDesktopRelease(value)).toBeNull();
        },
    );
    it.each([
        { ...asset, state: 'new' },
        { ...asset, size: 0 },
        { ...asset, browser_download_url: 'https://example.com/file.exe' },
        { ...asset, name: 'Slacord-1.0.10-x64.exe' },
    ])('rejects incomplete or mismatched assets', (value) => {
        expect(parseDesktopRelease({ ...release, assets: [value] })).toBeNull();
    });
});
