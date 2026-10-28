export class DiagramRenderTimeout extends Error {
    constructor() {
        super('Diagram rendering exceeded its deadline.');
        this.name = 'DiagramRenderTimeout';
    }
}

/** A timed-out job cannot publish a late result or indefinitely hold the UI queue. */
export function createDiagramRenderQueue(timeoutMs = 5000) {
    let tail: Promise<void> = Promise.resolve();
    return function schedule<T>(work: (isActive: () => boolean) => Promise<T>): Promise<T> {
        let active = true;
        let release!: () => void;
        const expired = new Promise<void>((resolve) => {
            release = resolve;
        });
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                if (!active) return;
                active = false;
                reject(new DiagramRenderTimeout());
                release();
            }, timeoutMs);
            const execute = async () => {
                if (!active) return;
                const rendering = Promise.resolve()
                    .then(() => work(() => active))
                    .then(
                        (value) => {
                            if (active) {
                                active = false;
                                clearTimeout(timer);
                                resolve(value);
                            }
                        },
                        (error: unknown) => {
                            if (active) {
                                active = false;
                                clearTimeout(timer);
                                reject(error);
                            }
                        },
                    );
                await Promise.race([rendering, expired]);
            };
            tail = tail.then(execute, execute);
        });
    };
}
