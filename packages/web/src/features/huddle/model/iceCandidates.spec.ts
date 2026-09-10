import { describe, expect, it, vi } from 'vitest';
import { PendingIceCandidates } from './iceCandidates';

describe('out-of-order ICE delivery', () => {
    it('buffers candidates before SDP and flushes them after remote description', async () => {
        const queue = new PendingIceCandidates();
        const candidate = { candidate: 'candidate:early' };
        const peer = { remoteDescription: null, addIceCandidate: vi.fn() };
        await queue.add('peer', peer as unknown as RTCPeerConnection, candidate);
        expect(peer.addIceCandidate).not.toHaveBeenCalled();
        await queue.flush('peer', peer as unknown as RTCPeerConnection);
        expect(peer.addIceCandidate).toHaveBeenCalledWith(candidate);
        peer.addIceCandidate.mockClear();
        await queue.flush('peer', peer as unknown as RTCPeerConnection);
        expect(peer.addIceCandidate).not.toHaveBeenCalled();
    });
    it('discards candidates from a closed peer', async () => {
        const queue = new PendingIceCandidates();
        await queue.add('peer', undefined, { candidate: 'old' });
        queue.clear('peer');
        const peer = { addIceCandidate: vi.fn() };
        await queue.flush('peer', peer as unknown as RTCPeerConnection);
        expect(peer.addIceCandidate).not.toHaveBeenCalled();
    });
});
