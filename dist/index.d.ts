/**
 * DiffCore - High-performance streaming JSON diff engine
 *
 * Zero-config WASM-powered structural comparison with:
 * - Automatic WASM loading (embedded Base64)
 * - Automatic memory cleanup via FinalizationRegistry
 * - Streaming chunk-based input
 * - Path-aware hash-assisted diffing
 *
 * @example
 * ```typescript
 * import { diff } from 'diffcore';
 *
 * const result = await diff(
 *   '{"name": "Alice"}',
 *   '{"name": "Bob"}'
 * );
 * console.log(result.entries);
 * // No .destroy() needed - automatic cleanup
 * ```
 */
import { Status, type DiffCoreConfig, type DiffResult } from './types.js';
export { Status, DiffOp, ArrayDiffMode, EDGE_CONFIG, type DiffCoreConfig, type DiffEntry, type DiffResult, } from './types.js';
/** Raw WASM exports */
interface WasmExports {
    memory: WebAssembly.Memory;
    create_engine: (configPtr: number, configLen: number) => number;
    get_left_input_ptr: (enginePtr: number) => number;
    get_right_input_ptr: (enginePtr: number) => number;
    commit_left: (enginePtr: number, len: number) => Status;
    commit_right: (enginePtr: number, len: number) => Status;
    finalize: (enginePtr: number) => number;
    get_result_len: (enginePtr: number) => number;
    destroy_engine: (enginePtr: number) => Status;
    get_last_error: (enginePtr: number) => number;
    get_last_error_len: (enginePtr: number) => number;
}
/**
 * DiffCore Engine - streaming JSON diff with automatic memory management.
 *
 * Memory is automatically cleaned up when the engine is garbage collected.
 * You can still call `.destroy()` explicitly for immediate cleanup.
 *
 * @example
 * ```typescript
 * const engine = await createEngine();
 * engine.pushLeft(new TextEncoder().encode('{"a": 1}'));
 * engine.pushRight(new TextEncoder().encode('{"a": 2}'));
 * const result = engine.finalize();
 * // No destroy() needed - automatic cleanup via FinalizationRegistry
 * ```
 */
export declare class DiffEngine {
    private wasm;
    private enginePtr;
    private destroyed;
    private leftInputPtr;
    private rightInputPtr;
    /** @internal Use createEngine() instead */
    constructor(wasm: WasmExports, config?: DiffCoreConfig);
    /**
     * Allocate memory and write data to WASM linear memory.
     * Uses memory from the heap base area (safe for configs).
     */
    private allocAndWrite;
    /**
     * Push a chunk of the left (original) JSON document.
     * Uses DMA: writes to managed buffer and commits.
     * @param chunk - Uint8Array of JSON bytes
     * @returns Status code indicating success or error
     */
    pushLeft(chunk: Uint8Array): Status;
    /**
     * Push a chunk of the right (modified) JSON document.
     * Uses DMA: writes to managed buffer and commits.
     * @param chunk - Uint8Array of JSON bytes
     * @returns Status code indicating success or error
     */
    pushRight(chunk: Uint8Array): Status;
    /**
     * Finalize the diff computation.
     * After calling this, no more chunks can be pushed.
     * @returns Parsed diff result with entries
     */
    finalize(): DiffResult;
    /**
     * Explicitly destroy the engine and free WASM memory.
     *
     * This is optional - memory is automatically cleaned up when the engine
     * is garbage collected via FinalizationRegistry. Call this for immediate
     * cleanup in memory-sensitive applications.
     */
    destroy(): void;
    /**
     * Check if the engine has been destroyed.
     */
    get isDestroyed(): boolean;
    /**
     * Get last error message (if any).
     * @returns Error message or null if no error
     */
    getLastError(): string | null;
}
/**
 * Create a DiffCore engine instance with automatic WASM loading.
 *
 * The WASM module is embedded in the package and loaded automatically.
 * Memory is automatically cleaned up when the engine is garbage collected.
 *
 * @param config - Optional engine configuration with capability limits
 * @returns Promise resolving to a configured DiffEngine
 *
 * @example
 * ```typescript
 * const engine = await createEngine();
 * engine.pushLeft(new TextEncoder().encode('{"a": 1}'));
 * engine.pushRight(new TextEncoder().encode('{"a": 2}'));
 * const result = engine.finalize();
 * console.log(result.entries);
 * // No destroy() needed - automatic cleanup
 * ```
 */
export declare function createEngine(config?: DiffCoreConfig): Promise<DiffEngine>;
/**
 * Advanced: Create engine with custom WASM source.
 *
 * Use this if you want to:
 * - Load WASM from a CDN
 * - Use a custom-compiled WASM binary
 * - Control WASM caching yourself
 *
 * @param wasmSource - Path, URL, ArrayBuffer, or pre-compiled Module
 * @param config - Optional engine configuration
 */
export declare function createEngineWithWasm(wasmSource: string | URL | ArrayBuffer | WebAssembly.Module, config?: DiffCoreConfig): Promise<DiffEngine>;
/**
 * One-shot diff for convenience (non-streaming).
 *
 * This is the simplest way to diff two JSON documents. The WASM module is
 * loaded automatically and memory is cleaned up after the diff completes.
 *
 * @param left - Left (original) JSON as string or Uint8Array
 * @param right - Right (modified) JSON as string or Uint8Array
 * @param config - Optional engine configuration
 * @returns Promise resolving to diff result
 *
 * @example
 * ```typescript
 * import { diff } from 'diffcore';
 *
 * const result = await diff(
 *   '{"users": [{"name": "Alice"}]}',
 *   '{"users": [{"name": "Bob"}]}'
 * );
 *
 * for (const entry of result.entries) {
 *   console.log(`${entry.op}: ${entry.path}`);
 * }
 * ```
 */
export declare function diff(left: Uint8Array | string, right: Uint8Array | string, config?: DiffCoreConfig): Promise<DiffResult>;
//# sourceMappingURL=index.d.ts.map