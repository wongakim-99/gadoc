import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import { io, type Socket } from 'socket.io-client';
import { socketUrl } from '@/lib/runtime-config';
import type { SaveStatus } from './DocumentSaveQueue';

type Presence = { clientId: number; clock: number; state: Record<string, unknown> | null };
export type CollaborationState = {
    ready: boolean;
    connected: boolean;
    canEdit: boolean;
    status: SaveStatus;
    error: string;
    peers: Array<{ id: number; name: string; color: string; editing: boolean }>;
    title?: string;
    updatedAt?: string;
};
type Reply = { ok: boolean; message?: string; updatedAt?: string; canEdit?: boolean };

/** Only acknowledged updates are removed. Reconnect merges the server state first. */
export class DocumentCollaborationProvider {
    readonly doc = new Y.Doc();
    readonly awareness = new Awareness(this.doc);
    user = { name: '나', color: '#61a8ff' };
    state: CollaborationState = {
        ready: false,
        connected: false,
        canEdit: false,
        status: 'saved',
        error: '',
        peers: [],
    };
    private readonly socket: Socket;
    private readonly listeners = new Set<() => void>();
    private pending: Uint8Array[] = [];
    private running: Promise<boolean> | null = null;
    private saveTimer?: ReturnType<typeof setTimeout>;
    private presenceTimer?: ReturnType<typeof setTimeout>;
    private editingTimer?: ReturnType<typeof setTimeout>;
    private heartbeat: ReturnType<typeof setInterval>;
    private closed = false;

    constructor(
        private readonly teamId: string,
        private readonly documentId: string,
    ) {
        this.socket = io(`${socketUrl()}/document`, {
            path: '/socket.io',
            transports: ['websocket'],
            withCredentials: true,
        });
        this.doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === this || this.closed) return;
            this.pending.push(update);
            this.set({ status: 'pending' });
            this.awareness.setLocalStateField('editing', true);
            clearTimeout(this.editingTimer);
            this.editingTimer = setTimeout(() => this.awareness.setLocalStateField('editing', false), 1800);
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => void this.flush(), 250);
        });
        this.awareness.on('update', (_: unknown, origin: unknown) => {
            this.refreshPeers();
            if (origin === this || this.closed) return;
            clearTimeout(this.presenceTimer);
            this.presenceTimer = setTimeout(() => void this.sendPresence(), 80);
        });
        this.socket.on('connect', () => void this.join());
        this.socket.on('disconnect', () => {
            removeAwarenessStates(
                this.awareness,
                [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID),
                this,
            );
            this.set({ connected: false, error: '연결이 끊겼습니다. 재연결 전에는 이 페이지를 닫지 마세요.' });
        });
        this.socket.on('connect_error', () =>
            this.set({
                connected: false,
                error: '공동 편집 서버에 연결하지 못했습니다. 연결을 다시 시도하고 있습니다.',
            }),
        );
        this.socket.on('document:sync', (event: { update?: Uint8Array; title: string; updatedAt: string }) => {
            if (event.update) Y.applyUpdate(this.doc, new Uint8Array(event.update), this);
            this.set({ title: event.title, updatedAt: event.updatedAt });
        });
        this.socket.on('document:awareness', (event: Presence) => this.receivePresence(event));
        this.socket.on('document:denied', (event: { message: string }) => this.deny(event.message));
        this.heartbeat = setInterval(() => {
            if (this.state.connected) void this.sendPresence();
        }, 15_000);
    }
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    get dirty() {
        return this.pending.length > 0 || this.running !== null;
    }
    private set(change: Partial<CollaborationState>) {
        this.state = { ...this.state, ...change };
        for (const listener of this.listeners) listener();
    }
    private async join() {
        try {
            const result = (await this.socket.timeout(12_000).emitWithAck('document:join', {
                teamId: this.teamId,
                documentId: this.documentId,
                clientId: this.doc.clientID,
            })) as Reply & {
                update: Uint8Array;
                title: string;
                canEdit: boolean;
                user: { name: string; color: string };
                peers: Presence[];
            };
            if (this.closed) return;
            if (!result.ok) {
                this.deny(result.message);
                return;
            }
            const update = new Uint8Array(result.update);
            Y.applyUpdate(this.doc, update, this);
            const missing = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVectorFromUpdate(update));
            this.pending = missing.length > 2 ? [missing] : [];
            this.user = result.user;
            this.awareness.setLocalStateField('user', result.user);
            this.awareness.setLocalStateField('editing', false);
            for (const peer of result.peers) this.receivePresence(peer);
            this.set({
                ready: true,
                connected: true,
                canEdit: result.canEdit,
                title: result.title,
                updatedAt: result.updatedAt,
                error: '',
                status: this.pending.length ? 'pending' : 'saved',
            });
            void this.sendPresence();
            void this.flush();
        } catch {
            this.set({ connected: false, error: '문서 연결을 확인하지 못했습니다. 다시 연결해 주세요.' });
        }
    }
    private deny(message?: string) {
        this.set({
            connected: false,
            canEdit: false,
            status: this.dirty ? 'error' : 'saved',
            error: message || '문서 접근 권한을 확인해 주세요.',
        });
    }
    private receivePresence(event: Presence) {
        if (event.clientId === this.doc.clientID) return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1);
        encoding.writeVarUint(encoder, event.clientId);
        encoding.writeVarUint(encoder, event.clock);
        encoding.writeVarString(encoder, JSON.stringify(event.state));
        applyAwarenessUpdate(this.awareness, encoding.toUint8Array(encoder), this);
    }
    private refreshPeers() {
        this.set({
            peers: [...this.awareness.getStates()]
                .filter(([id, state]) => id !== this.doc.clientID && state.user)
                .map(([id, state]) => ({
                    id,
                    name: String(state.user.name),
                    color: String(state.user.color),
                    editing: state.editing === true,
                })),
        });
    }
    private async sendPresence() {
        if (this.closed || !this.state.connected) return;
        try {
            const result = (await this.socket.timeout(8000).emitWithAck('document:awareness', {
                state: this.awareness.getLocalState(),
                clock: this.awareness.meta.get(this.doc.clientID)?.clock ?? 0,
            })) as Reply;
            if (!result.ok) this.deny(result.message);
            else if (typeof result.canEdit === 'boolean') this.set({ canEdit: result.canEdit });
        } catch {
            /* The socket reconnect handler owns transport errors. */
        }
    }
    flush(): Promise<boolean> {
        clearTimeout(this.saveTimer);
        if (this.running) return this.running;
        if (!this.pending.length) return Promise.resolve(true);
        if (!this.state.connected || !this.state.canEdit) return Promise.resolve(false);
        this.running = this.drain().finally(() => {
            this.running = null;
        });
        return this.running;
    }
    private async drain() {
        while (this.pending.length && this.state.connected && !this.closed) {
            const batch = this.pending.splice(0);
            this.set({ status: 'saving', error: '' });
            try {
                const update = Y.mergeUpdates(batch);
                if (update.length > 256 * 1024)
                    throw new Error('한 번에 입력한 내용이 너무 큽니다. 내용을 복사해 보관한 뒤 나누어 입력해 주세요.');
                const result = (await this.socket.timeout(12_000).emitWithAck('document:update', { update })) as Reply;
                if (!result.ok) throw new Error(result.message);
                this.set({ updatedAt: result.updatedAt });
            } catch (error) {
                this.pending.unshift(...batch);
                this.set({
                    status: 'error',
                    error:
                        error instanceof Error
                            ? error.message
                            : '저장하지 못했습니다. 이 페이지에서 다시 시도해 주세요.',
                });
                return false;
            }
        }
        this.set({ status: this.pending.length ? 'pending' : 'saved' });
        return this.pending.length === 0;
    }
    reconnect() {
        if (this.socket.connected) void this.join();
        else this.socket.connect();
    }
    destroy() {
        this.closed = true;
        clearTimeout(this.saveTimer);
        clearTimeout(this.presenceTimer);
        clearTimeout(this.editingTimer);
        clearInterval(this.heartbeat);
        this.socket.emit('document:leave');
        this.socket.disconnect();
        this.listeners.clear();
        this.awareness.destroy();
        this.doc.destroy();
    }
}
