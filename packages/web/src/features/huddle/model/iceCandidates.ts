/** ICE can arrive before its SDP because the signaling handlers run asynchronously. */
export class PendingIceCandidates {
    private readonly pending = new Map<string, RTCIceCandidateInit[]>();

    async add(userId: string, peer: RTCPeerConnection | undefined, candidate: RTCIceCandidateInit) {
        if (!peer?.remoteDescription) {
            const candidates = this.pending.get(userId) ?? [];
            if (candidates.length < 100) candidates.push(candidate);
            this.pending.set(userId, candidates);
            return;
        }
        await peer.addIceCandidate(candidate);
    }

    async flush(userId: string, peer: RTCPeerConnection) {
        const candidates = this.pending.get(userId) ?? [];
        this.pending.delete(userId);
        for (const candidate of candidates) await peer.addIceCandidate(candidate);
    }

    clear(userId: string) {
        this.pending.delete(userId);
    }
}
