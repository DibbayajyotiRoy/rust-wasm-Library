/**
 * DiffCore Web Worker Protocol
 *
 * Message-based protocol for off-main-thread execution.
 * Uses Transferable buffers for zero-copy performance.
 */
/**
 * Worker-side handler
 *
 * Usage in worker.js:
 * ```javascript
 * import { createWorkerHandler } from 'diffcore/worker';
 * const handler = createWorkerHandler();
 * self.onmessage = (e) => handler(e.data).then(r => self.postMessage(r));
 * ```
 */
export function createWorkerHandler() {
    let engine = null;
    let wasm = null;
    return async function handleMessage(msg) {
        try {
            switch (msg.type) {
                case 'init': {
                    const module = await WebAssembly.compile(msg.wasmBytes);
                    const instance = await WebAssembly.instantiate(module, { env: {} });
                    wasm = instance.exports;
                    // Import dynamically to avoid circular deps
                    const { DiffEngine } = await import('./index.js');
                    engine = new DiffEngine(wasm, msg.config ?? {});
                    return { type: 'ready' };
                }
                case 'push_left': {
                    if (!engine)
                        return { type: 'error', message: 'Engine not initialized' };
                    const status = engine.pushLeft(new Uint8Array(msg.buffer));
                    return { type: 'status', status };
                }
                case 'push_right': {
                    if (!engine)
                        return { type: 'error', message: 'Engine not initialized' };
                    const status = engine.pushRight(new Uint8Array(msg.buffer));
                    return { type: 'status', status };
                }
                case 'finalize': {
                    if (!engine)
                        return { type: 'error', message: 'Engine not initialized' };
                    const result = engine.finalize();
                    return { type: 'result', data: result };
                }
                case 'destroy': {
                    if (engine) {
                        engine.destroy();
                        engine = null;
                    }
                    return { type: 'destroyed' };
                }
                default:
                    return { type: 'error', message: `Unknown message type` };
            }
        }
        catch (e) {
            return { type: 'error', message: e instanceof Error ? e.message : String(e) };
        }
    };
}
/**
 * Client-side Worker wrapper
 *
 * Manages a Web Worker running DiffCore for off-main-thread execution.
 */
export class DiffCoreWorker {
    worker;
    pending = new Map();
    messageId = 0;
    constructor(workerUrl) {
        this.worker = new Worker(workerUrl, { type: 'module' });
        this.worker.onmessage = this.handleResponse.bind(this);
        this.worker.onerror = (e) => {
            console.error('DiffCore Worker error:', e);
        };
    }
    handleResponse(event) {
        // For now, responses are handled inline
        // In a full implementation, we'd match message IDs
    }
    send(msg, transfer) {
        return new Promise((resolve, reject) => {
            const id = this.messageId++;
            this.pending.set(id, { resolve, reject });
            const handler = (e) => {
                this.pending.delete(id);
                this.worker.removeEventListener('message', handler);
                resolve(e.data);
            };
            this.worker.addEventListener('message', handler);
            this.worker.postMessage(msg, transfer ?? []);
        });
    }
    /**
     * Initialize the worker with WASM bytes.
     * Uses Transferable to move buffer without copying.
     */
    async init(wasmBytes, config) {
        const response = await this.send({ type: 'init', config, wasmBytes }, [wasmBytes] // Transfer ownership
        );
        if (response.type === 'error') {
            throw new Error(response.message);
        }
    }
    /**
     * Push left chunk. Uses Transferable for zero-copy.
     */
    async pushLeft(buffer) {
        const response = await this.send({ type: 'push_left', buffer }, [buffer]);
        if (response.type === 'error')
            throw new Error(response.message);
        if (response.type === 'status')
            return response.status;
        throw new Error('Unexpected response');
    }
    /**
     * Push right chunk. Uses Transferable for zero-copy.
     */
    async pushRight(buffer) {
        const response = await this.send({ type: 'push_right', buffer }, [buffer]);
        if (response.type === 'error')
            throw new Error(response.message);
        if (response.type === 'status')
            return response.status;
        throw new Error('Unexpected response');
    }
    /**
     * Finalize and get diff result.
     */
    async finalize() {
        const response = await this.send({ type: 'finalize' });
        if (response.type === 'error')
            throw new Error(response.message);
        if (response.type === 'result')
            return response.data;
        throw new Error('Unexpected response');
    }
    /**
     * Destroy the worker.
     */
    async destroy() {
        await this.send({ type: 'destroy' });
        this.worker.terminate();
    }
}
//# sourceMappingURL=worker.js.map