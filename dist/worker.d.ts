/**
 * DiffCore Web Worker Protocol
 *
 * Message-based protocol for off-main-thread execution.
 * Uses Transferable buffers for zero-copy performance.
 */
import { Status, type DiffResult, type DiffCoreConfig } from './types.js';
/** Messages sent TO the worker */
export type WorkerRequest = {
    type: 'init';
    config?: DiffCoreConfig;
    wasmBytes: ArrayBuffer;
} | {
    type: 'push_left';
    buffer: ArrayBuffer;
} | {
    type: 'push_right';
    buffer: ArrayBuffer;
} | {
    type: 'finalize';
} | {
    type: 'destroy';
};
/** Messages sent FROM the worker */
export type WorkerResponse = {
    type: 'ready';
} | {
    type: 'status';
    status: Status;
} | {
    type: 'result';
    data: DiffResult;
} | {
    type: 'error';
    message: string;
} | {
    type: 'destroyed';
};
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
export declare function createWorkerHandler(): (msg: WorkerRequest) => Promise<WorkerResponse>;
/**
 * Client-side Worker wrapper
 *
 * Manages a Web Worker running DiffCore for off-main-thread execution.
 */
export declare class DiffCoreWorker {
    private worker;
    private pending;
    private messageId;
    constructor(workerUrl: string | URL);
    private handleResponse;
    private send;
    /**
     * Initialize the worker with WASM bytes.
     * Uses Transferable to move buffer without copying.
     */
    init(wasmBytes: ArrayBuffer, config?: DiffCoreConfig): Promise<void>;
    /**
     * Push left chunk. Uses Transferable for zero-copy.
     */
    pushLeft(buffer: ArrayBuffer): Promise<Status>;
    /**
     * Push right chunk. Uses Transferable for zero-copy.
     */
    pushRight(buffer: ArrayBuffer): Promise<Status>;
    /**
     * Finalize and get diff result.
     */
    finalize(): Promise<DiffResult>;
    /**
     * Destroy the worker.
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=worker.d.ts.map