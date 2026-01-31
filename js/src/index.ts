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

import {
    Status,
    DiffOp,
    ArrayDiffMode,
    type DiffCoreConfig,
    type DiffEntry,
    type DiffResult,
} from './types.js';

export {
    Status,
    DiffOp,
    ArrayDiffMode,
    EDGE_CONFIG,
    type DiffCoreConfig,
    type DiffEntry,
    type DiffResult,
} from './types.js';

/** Raw WASM exports */
interface WasmExports {
    memory: WebAssembly.Memory;
    create_engine: (configPtr: number, configLen: number) => number;
    // DMA API - write directly to managed buffers, then commit
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
 * FinalizationRegistry for automatic WASM memory cleanup.
 * When a DiffEngine is garbage collected, this automatically calls destroy_engine.
 */
const engineRegistry = new FinalizationRegistry<{
    wasm: WasmExports;
    enginePtr: number;
}>((held) => {
    if (held.enginePtr !== 0) {
        try {
            held.wasm.destroy_engine(held.enginePtr);
        } catch {
            // Ignore errors during finalization
        }
    }
});

/**
 * Serialize config to binary format expected by Rust.
 * Format (20 bytes, little-endian):
 * [u32 max_memory_bytes]    (0-3)
 * [u32 max_input_size]      (4-7)
 * [u32 max_object_keys]     (8-11)
 * [u8  array_diff_mode]     (12)
 * [u16 hash_window_size]    (13-14)
 * [u32 max_full_array_size] (15-18)
 * [u8  compute_mode]        (19)
 */
function serializeConfig(config: DiffCoreConfig): Uint8Array {
    const buf = new ArrayBuffer(20);
    const view = new DataView(buf);

    view.setUint32(0, config.maxMemoryBytes ?? 32 * 1024 * 1024, true);
    view.setUint32(4, config.maxInputSize ?? 64 * 1024 * 1024, true);
    view.setUint32(8, config.maxObjectKeys ?? 100_000, true);
    view.setUint8(12, config.arrayDiffMode ?? ArrayDiffMode.Index);
    view.setUint16(13, config.hashWindowSize ?? 64, true);
    view.setUint32(15, config.maxFullArraySize ?? 1024, true);
    view.setUint8(19, 0); // compute_mode: 0=Latency (default)

    return new Uint8Array(buf);
}

/**
 * Parse binary diff result to structured entries.
 * 
 * Header format (16 bytes):
 * [u16 major][u16 minor][u32 count][u64 total_len]
 * 
 * Entry format v2.1 (32 bytes each):
 * [0]     op (u8)
 * [1..8]  padding
 * [8..16] path_id (u64) - symbolic hash, not resolved to string
 * [16..20] left_offset (u32)
 * [20..24] left_len (u32)
 * [24..28] right_offset (u32)
 * [28..32] right_len (u32)
 */
function parseResult(buffer: Uint8Array): DiffResult {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const major = view.getUint16(0, true);
    const minor = view.getUint16(2, true);
    const entryCount = view.getUint32(4, true);
    // totalLen at offset 8-15 (u64)

    const entries: DiffEntry[] = [];
    const HEADER_SIZE = 16;
    const ENTRY_SIZE = 32;

    for (let i = 0; i < entryCount; i++) {
        const entryOffset = HEADER_SIZE + (i * ENTRY_SIZE);
        if (entryOffset + ENTRY_SIZE > buffer.length) break;

        const op = view.getUint8(entryOffset) as DiffOp;
        // path_id at offset 8-15 (u64) - we use it as a hash string for now
        const pathIdLow = view.getUint32(entryOffset + 8, true);
        const pathIdHigh = view.getUint32(entryOffset + 12, true);
        const path = `$.h${pathIdHigh.toString(16)}${pathIdLow.toString(16).padStart(8, '0')}`;

        const leftOffset = view.getUint32(entryOffset + 16, true);
        const leftLen = view.getUint32(entryOffset + 20, true);
        const rightOffset = view.getUint32(entryOffset + 24, true);
        const rightLen = view.getUint32(entryOffset + 28, true);

        // Values are offsets into the original input, not included in result buffer
        // For now, we don't have access to original input, so we store the offset info
        const leftValue = leftLen > 0 ? new TextEncoder().encode(`@${leftOffset}:${leftLen}`) : undefined;
        const rightValue = rightLen > 0 ? new TextEncoder().encode(`@${rightOffset}:${rightLen}`) : undefined;

        entries.push({ op, path, leftValue, rightValue });
    }

    return { version: { major, minor }, entries, raw: buffer };
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
export class DiffEngine {
    private wasm: WasmExports;
    private enginePtr: number = 0;
    private destroyed: boolean = false;
    private leftInputPtr: number = 0;
    private rightInputPtr: number = 0;

    /** @internal Use createEngine() instead */
    constructor(wasm: WasmExports, config: DiffCoreConfig = {}) {
        this.wasm = wasm;

        // Create engine with config (engine allocates its own managed buffers)
        const configBytes = serializeConfig(config);

        // Write config to WASM memory using the internal allocator
        const configPtr = this.allocAndWrite(configBytes);
        this.enginePtr = wasm.create_engine(configPtr, configBytes.length);

        if (this.enginePtr === 0) {
            throw new Error('Failed to create DiffCore engine');
        }

        // Get managed input buffer pointers from the engine
        this.leftInputPtr = wasm.get_left_input_ptr(this.enginePtr);
        this.rightInputPtr = wasm.get_right_input_ptr(this.enginePtr);

        // Register for automatic cleanup when garbage collected
        engineRegistry.register(this, { wasm, enginePtr: this.enginePtr }, this);
    }

    /**
     * Allocate memory and write data to WASM linear memory.
     * Uses memory from the heap base area (safe for configs).
     */
    private allocAndWrite(data: Uint8Array): number {
        // Use a simple offset from heap base for config data
        // The engine manages its own input buffers
        const ptr = 1024; // Fixed offset for config (safe in small allocations)
        new Uint8Array(this.wasm.memory.buffer).set(data, ptr);
        return ptr;
    }

    /**
     * Push a chunk of the left (original) JSON document.
     * Uses DMA: writes to managed buffer and commits.
     * @param chunk - Uint8Array of JSON bytes
     * @returns Status code indicating success or error
     */
    pushLeft(chunk: Uint8Array): Status {
        if (this.destroyed) throw new Error('Engine already destroyed');
        if (this.leftInputPtr === 0) throw new Error('Left input buffer not available');

        // Write directly to the managed left input buffer
        new Uint8Array(this.wasm.memory.buffer).set(chunk, this.leftInputPtr);
        return this.wasm.commit_left(this.enginePtr, chunk.length);
    }

    /**
     * Push a chunk of the right (modified) JSON document.
     * Uses DMA: writes to managed buffer and commits.
     * @param chunk - Uint8Array of JSON bytes
     * @returns Status code indicating success or error
     */
    pushRight(chunk: Uint8Array): Status {
        if (this.destroyed) throw new Error('Engine already destroyed');
        if (this.rightInputPtr === 0) throw new Error('Right input buffer not available');

        // Write directly to the managed right input buffer
        new Uint8Array(this.wasm.memory.buffer).set(chunk, this.rightInputPtr);
        return this.wasm.commit_right(this.enginePtr, chunk.length);
    }

    /**
     * Finalize the diff computation.
     * After calling this, no more chunks can be pushed.
     * @returns Parsed diff result with entries
     */
    finalize(): DiffResult {
        if (this.destroyed) throw new Error('Engine already destroyed');

        const resultPtr = this.wasm.finalize(this.enginePtr);
        if (resultPtr === 0) {
            const errorPtr = this.wasm.get_last_error(this.enginePtr);
            const errorLen = this.wasm.get_last_error_len(this.enginePtr);
            if (errorPtr !== 0 && errorLen > 0) {
                const errorBytes = new Uint8Array(this.wasm.memory.buffer, errorPtr, errorLen);
                throw new Error(new TextDecoder().decode(errorBytes));
            }
            throw new Error('Finalization failed');
        }

        const resultLen = this.wasm.get_result_len(this.enginePtr);
        const resultBytes = new Uint8Array(this.wasm.memory.buffer, resultPtr, resultLen);

        // Copy result to avoid memory issues after destroy
        const resultCopy = new Uint8Array(resultLen);
        resultCopy.set(resultBytes);

        return parseResult(resultCopy);
    }

    /**
     * Explicitly destroy the engine and free WASM memory.
     *
     * This is optional - memory is automatically cleaned up when the engine
     * is garbage collected via FinalizationRegistry. Call this for immediate
     * cleanup in memory-sensitive applications.
     */
    destroy(): void {
        if (!this.destroyed && this.enginePtr !== 0) {
            // Unregister from FinalizationRegistry to avoid double-free
            engineRegistry.unregister(this);
            this.wasm.destroy_engine(this.enginePtr);
            this.enginePtr = 0;
            this.destroyed = true;
        }
    }

    /**
     * Check if the engine has been destroyed.
     */
    get isDestroyed(): boolean {
        return this.destroyed;
    }

    /**
     * Get last error message (if any).
     * @returns Error message or null if no error
     */
    getLastError(): string | null {
        if (this.destroyed) return null;
        const errorPtr = this.wasm.get_last_error(this.enginePtr);
        const errorLen = this.wasm.get_last_error_len(this.enginePtr);
        if (errorPtr === 0 || errorLen === 0) return null;

        const errorBytes = new Uint8Array(this.wasm.memory.buffer, errorPtr, errorLen);
        return new TextDecoder().decode(errorBytes);
    }
}

/** Cached WASM module for reuse across engine instances */
let cachedWasmModule: WebAssembly.Module | null = null;

/**
 * Load the embedded WASM module.
 * Caches the module for reuse across multiple engine instances.
 */
async function loadEmbeddedWasm(): Promise<WebAssembly.Module> {
    if (cachedWasmModule) return cachedWasmModule;

    const { getWasmModule } = await import('./wasm-embedded.js');
    cachedWasmModule = await getWasmModule();
    return cachedWasmModule;
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
export async function createEngine(config: DiffCoreConfig = {}): Promise<DiffEngine> {
    const module = await loadEmbeddedWasm();

    const instance = await WebAssembly.instantiate(module, {
        env: {
            // No imports needed - we use raw C ABI
        },
    });

    const wasm = instance.exports as unknown as WasmExports;
    return new DiffEngine(wasm, config);
}

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
export async function createEngineWithWasm(
    wasmSource: string | URL | ArrayBuffer | WebAssembly.Module,
    config: DiffCoreConfig = {}
): Promise<DiffEngine> {
    const module = await loadWasmModule(wasmSource);

    const instance = await WebAssembly.instantiate(module, {
        env: {},
    });

    const wasm = instance.exports as unknown as WasmExports;
    return new DiffEngine(wasm, config);
}

/**
 * Load WASM module from various sources (for advanced usage).
 */
async function loadWasmModule(
    source: string | URL | ArrayBuffer | WebAssembly.Module
): Promise<WebAssembly.Module> {
    if (source instanceof WebAssembly.Module) {
        return source;
    }

    if (source instanceof ArrayBuffer) {
        return WebAssembly.compile(source);
    }

    // Detect environment
    const isNode = typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node;

    if (isNode) {
        // Node.js - read from filesystem
        const fs = await import('fs/promises');
        const path = source instanceof URL ? source.pathname : source.toString();
        const buffer = await fs.readFile(path);
        return WebAssembly.compile(buffer);
    }

    // Browser or Edge - fetch
    const url = source instanceof URL ? source : new URL(source, import.meta.url);
    const response = await fetch(url);

    if (typeof WebAssembly.compileStreaming === 'function') {
        return WebAssembly.compileStreaming(response);
    }

    const buffer = await response.arrayBuffer();
    return WebAssembly.compile(buffer);
}

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
export async function diff(
    left: Uint8Array | string,
    right: Uint8Array | string,
    config: DiffCoreConfig = {}
): Promise<DiffResult> {
    const engine = await createEngine(config);

    try {
        const leftBytes = typeof left === 'string' ? new TextEncoder().encode(left) : left;
        const rightBytes = typeof right === 'string' ? new TextEncoder().encode(right) : right;

        const leftStatus = engine.pushLeft(leftBytes);
        if (leftStatus !== Status.Ok) {
            throw new Error(`push_left failed with status ${Status[leftStatus]}`);
        }

        const rightStatus = engine.pushRight(rightBytes);
        if (rightStatus !== Status.Ok) {
            throw new Error(`push_right failed with status ${Status[rightStatus]}`);
        }

        return engine.finalize();
    } finally {
        engine.destroy();
    }
}
