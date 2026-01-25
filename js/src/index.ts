/**
 * DiffCore - Universal WASM Loader
 * 
 * Works in: Browser, Node.js, Edge runtimes (Cloudflare Workers)
 * Same .wasm binary, same results everywhere.
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
    push_left: (enginePtr: number, chunkPtr: number, chunkLen: number) => Status;
    push_right: (enginePtr: number, chunkPtr: number, chunkLen: number) => Status;
    finalize: (enginePtr: number) => number;
    get_result_len: (enginePtr: number) => number;
    destroy_engine: (enginePtr: number) => Status;
    get_last_error: (enginePtr: number) => number;
    get_last_error_len: (enginePtr: number) => number;
}

/** 
 * Performance disclaimer (honest engineering):
 * For inputs < 10KB, JS may outperform WASM due to instantiation 
 * and boundary overhead. WASM advantage appears above ~50KB.
 */

/**
 * Serialize config to binary format expected by Rust.
 * Format: [u32 max_memory][u32 max_input][u32 max_keys][u8 mode][u16 window][u32 max_arr]
 */
function serializeConfig(config: DiffCoreConfig): Uint8Array {
    const buf = new ArrayBuffer(19);
    const view = new DataView(buf);

    view.setUint32(0, config.maxMemoryBytes ?? 32 * 1024 * 1024, true);
    view.setUint32(4, config.maxInputSize ?? 64 * 1024 * 1024, true);
    view.setUint32(8, config.maxObjectKeys ?? 100_000, true);
    view.setUint8(12, config.arrayDiffMode ?? ArrayDiffMode.Index);
    view.setUint16(13, config.hashWindowSize ?? 64, true);
    view.setUint32(15, config.maxFullArraySize ?? 1024, true);

    return new Uint8Array(buf);
}

/**
 * Parse binary diff result to structured entries.
 * Format: [u16 major][u16 minor][u32 count][entries...]
 */
function parseResult(buffer: Uint8Array): DiffResult {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const major = view.getUint16(0, true);
    const minor = view.getUint16(2, true);
    const entryCount = view.getUint32(4, true);

    const entries: DiffEntry[] = [];
    let offset = 8;

    for (let i = 0; i < entryCount && offset < buffer.length; i++) {
        const op = view.getUint8(offset) as DiffOp;
        offset += 1;

        const pathLen = view.getUint32(offset, true);
        offset += 4;

        const pathBytes = buffer.slice(offset, offset + pathLen);
        const path = new TextDecoder().decode(pathBytes);
        offset += pathLen;

        const leftLen = view.getUint32(offset, true);
        offset += 4;

        const leftValue = leftLen > 0 ? buffer.slice(offset, offset + leftLen) : undefined;
        offset += leftLen;

        const rightLen = view.getUint32(offset, true);
        offset += 4;

        const rightValue = rightLen > 0 ? buffer.slice(offset, offset + rightLen) : undefined;
        offset += rightLen;

        // Skip alignment padding (align to 8 bytes)
        const entrySize = 1 + 4 + pathLen + 4 + leftLen + 4 + rightLen;
        const padding = (8 - (entrySize % 8)) % 8;
        offset += padding;

        entries.push({ op, path, leftValue, rightValue });
    }

    return { version: { major, minor }, entries, raw: buffer };
}

/**
 * DiffCore Engine - streaming JSON diff
 */
export class DiffEngine {
    private wasm: WasmExports;
    private enginePtr: number = 0;
    private inputBuffer: Uint8Array;
    private inputOffset: number = 0;

    constructor(wasm: WasmExports, config: DiffCoreConfig = {}) {
        this.wasm = wasm;

        // Allocate input buffer in WASM memory
        const memSize = (config.maxInputSize ?? 64 * 1024 * 1024) * 2; // Left + right
        const currentPages = wasm.memory.buffer.byteLength / 65536;
        const neededPages = Math.ceil(memSize / 65536);

        if (neededPages > currentPages) {
            wasm.memory.grow(neededPages - currentPages);
        }

        this.inputBuffer = new Uint8Array(wasm.memory.buffer);
        this.inputOffset = 1024; // Reserve space for config

        // Create engine with config
        const configBytes = serializeConfig(config);
        const configPtr = this.writeToMemory(configBytes);
        this.enginePtr = wasm.create_engine(configPtr, configBytes.length);

        if (this.enginePtr === 0) {
            throw new Error('Failed to create DiffCore engine');
        }
    }

    private writeToMemory(data: Uint8Array): number {
        const ptr = this.inputOffset;
        new Uint8Array(this.wasm.memory.buffer).set(data, ptr);
        this.inputOffset += data.length;
        // Align to 8 bytes
        this.inputOffset = (this.inputOffset + 7) & ~7;
        return ptr;
    }

    /**
     * Push a chunk of the left (original) JSON document.
     */
    pushLeft(chunk: Uint8Array): Status {
        const ptr = this.writeToMemory(chunk);
        return this.wasm.push_left(this.enginePtr, ptr, chunk.length);
    }

    /**
     * Push a chunk of the right (modified) JSON document.
     */
    pushRight(chunk: Uint8Array): Status {
        const ptr = this.writeToMemory(chunk);
        return this.wasm.push_right(this.enginePtr, ptr, chunk.length);
    }

    /**
     * Finalize the diff computation.
     * After calling this, no more chunks can be pushed.
     */
    finalize(): DiffResult {
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
     * Destroy the engine and free memory.
     * Safe to call multiple times.
     */
    destroy(): void {
        if (this.enginePtr !== 0) {
            this.wasm.destroy_engine(this.enginePtr);
            this.enginePtr = 0;
        }
    }

    /**
     * Get last error message (if any).
     */
    getLastError(): string | null {
        const errorPtr = this.wasm.get_last_error(this.enginePtr);
        const errorLen = this.wasm.get_last_error_len(this.enginePtr);
        if (errorPtr === 0 || errorLen === 0) return null;

        const errorBytes = new Uint8Array(this.wasm.memory.buffer, errorPtr, errorLen);
        return new TextDecoder().decode(errorBytes);
    }
}

/**
 * Detect runtime environment
 */
function detectEnvironment(): 'browser' | 'node' | 'edge' {
    if (typeof globalThis.Deno !== 'undefined') return 'edge';
    if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) return 'node';
    if (typeof globalThis.document !== 'undefined') return 'browser';
    // Cloudflare Workers, Vercel Edge, etc.
    return 'edge';
}

/**
 * Load WASM module from various sources.
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

    const env = detectEnvironment();

    if (env === 'node') {
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
 * Create a DiffCore engine instance.
 * 
 * @param wasmSource - Path to .wasm file, URL, ArrayBuffer, or pre-compiled Module
 * @param config - Engine configuration with capability limits
 * 
 * @example
 * ```typescript
 * const engine = await createEngine('./diffcore.wasm');
 * engine.pushLeft(new TextEncoder().encode('{"a": 1}'));
 * engine.pushRight(new TextEncoder().encode('{"a": 2}'));
 * const result = engine.finalize();
 * console.log(result.entries);
 * engine.destroy();
 * ```
 */
export async function createEngine(
    wasmSource: string | URL | ArrayBuffer | WebAssembly.Module,
    config: DiffCoreConfig = {}
): Promise<DiffEngine> {
    const module = await loadWasmModule(wasmSource);

    const instance = await WebAssembly.instantiate(module, {
        env: {
            // No imports needed - we use raw C ABI
        },
    });

    const wasm = instance.exports as unknown as WasmExports;
    return new DiffEngine(wasm, config);
}

/**
 * One-shot diff for convenience (non-streaming).
 * 
 * @example
 * ```typescript
 * const result = await diff('./diffcore.wasm', leftJson, rightJson);
 * ```
 */
export async function diff(
    wasmSource: string | URL | ArrayBuffer | WebAssembly.Module,
    left: Uint8Array | string,
    right: Uint8Array | string,
    config: DiffCoreConfig = {}
): Promise<DiffResult> {
    const engine = await createEngine(wasmSource, config);

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
