export interface DocumentDraft {
    title: string;
    content: string;
}
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';
const same = (a: DocumentDraft, b: DocumentDraft) => a.title === b.title && a.content === b.content;

/** One request in flight; an acknowledgement never replaces the live draft. */
export class DocumentSaveQueue {
    private acknowledged: DocumentDraft;
    private desired: DocumentDraft;
    private running: Promise<boolean> | null = null;
    private paused = false;

    constructor(
        initial: DocumentDraft,
        private readonly save: (draft: DocumentDraft) => Promise<void>,
        private readonly notify: (status: SaveStatus, error?: string) => void,
    ) {
        this.acknowledged = { ...initial };
        this.desired = { ...initial };
    }

    get dirty() {
        return !same(this.desired, this.acknowledged);
    }
    get busy() {
        return this.running !== null;
    }
    update(draft: DocumentDraft) {
        this.desired = { ...draft };
        this.notify(this.running ? 'saving' : this.dirty ? 'pending' : 'saved');
    }
    pause(value: boolean) {
        this.paused = value;
    }

    flush(): Promise<boolean> {
        if (this.running) return this.running;
        if (this.paused) return Promise.resolve(false);
        if (!this.dirty) return Promise.resolve(true);
        this.running = this.drain().finally(() => {
            this.running = null;
        });
        return this.running;
    }

    private async drain(): Promise<boolean> {
        while (this.dirty && !this.paused) {
            const snapshot = { ...this.desired };
            this.notify('saving');
            try {
                await this.save(snapshot);
                this.acknowledged = snapshot;
            } catch (error) {
                this.notify('error', error instanceof Error ? error.message : '자동 저장에 실패했습니다.');
                return false;
            }
        }
        this.notify(this.dirty ? 'pending' : 'saved');
        return !this.dirty;
    }
}
