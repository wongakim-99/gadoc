import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, activeSettingsSection } from './settingsSections';

describe('settings sections', () => {
    it('uses the same section metadata for navigation and content', () => {
        for (const section of SETTINGS_SECTIONS) expect(activeSettingsSection(section.key)).toBe(section);
        expect(new Set(SETTINGS_SECTIONS.map((section) => section.key)).size).toBe(8);
    });
    it('keeps legacy empty and unknown links on delivery settings', () => {
        expect(activeSettingsSection(null).key).toBe('delivery');
        expect(activeSettingsSection('unknown').key).toBe('delivery');
    });
});
