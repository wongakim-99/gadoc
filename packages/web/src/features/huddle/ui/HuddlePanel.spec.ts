import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HuddlePanel } from './HuddlePanel';

const props = {
    activeChannelId: 'channel',
    participants: [{ userId: 'peer', audio: true, video: false }],
    localStream: null,
    localAudio: true,
    localVideo: false,
    sharingScreen: false,
    error: null,
    clearError() {},
    leaveHuddle() {},
    toggleAudio() {},
    toggleVideo() {},
    toggleScreenShare() {},
    currentUsername: 'Tester',
    channelName: 'general',
};

describe('HuddlePanel media output', () => {
    it('renders remote audio even when nobody has enabled a camera', () => {
        const html = renderToStaticMarkup(createElement(HuddlePanel, props));
        expect(html).toContain('data-huddle-audio="peer"');
        expect(html).not.toContain('<video');
    });
    it('mutes video tiles so audio is not played twice', () => {
        const html = renderToStaticMarkup(
            createElement(HuddlePanel, {
                ...props,
                participants: [{ userId: 'peer', audio: true, video: true, stream: {} as MediaStream }],
            }),
        );
        expect(html).toContain('data-huddle-audio="peer"');
        expect(html).toMatch(/<video[^>]*muted=""/);
    });
    it('removes audio players after leaving the call', () => {
        expect(renderToStaticMarkup(createElement(HuddlePanel, { ...props, activeChannelId: null }))).toBe('');
    });
});
