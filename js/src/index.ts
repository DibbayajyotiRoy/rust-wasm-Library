/**
 * DiffCore — High-performance streaming JSON diff engine.
 *
 * The simplest path is `diff(a, b)`:
 *
 * ```ts
 * import { diff } from 'diffcore';
 *
 * const result = await diff(
 *   '{"users":[{"name":"Alice"}]}',
 *   '{"users":[{"name":"Bob"}]}'
 * );
 *
 * for (const e of result.entries) {
 *   console.log(e.op, e.path, e.leftValue, '→', e.rightValue);
 *   // Modified  /users/0/name  Alice → Bob
 * }
 * ```
 *
 * - **Real JSON Pointer paths** (RFC 6901), not opaque hashes.
 * - **Decoded leaf values** (string / number / boolean / null).
 * - **Standard interop**: `toJsonPatch(result)` emits RFC 6902 ops.
 * - **State helpers**: `applyPatch` / `revertPatch` for undo / redo.
 * - **Zero config**: WASM is embedded, no toolchain needed.
 * - **Auto cleanup**: memory is freed via `FinalizationRegistry`.
 */

import {
    Status,
    ArrayDiffMode,
    DiffOp,
    type DiffCoreConfig,
    type DiffEntry,
    type DiffResult,
    type JsonScalar,
    type SerializedDiffResult,
} from "./types.js";

import { buildPathIndex, decodeLeafValue, pathIdFromU32Pair, type LeafInfo } from "./path-index.js";
import { DiffCoreError, EngineDestroyedError, FinalizationError, InvalidJsonError } from "./errors.js";

export {
    Status,
    DiffOp,
    ArrayDiffMode,
    EDGE_CONFIG,
    type DiffCoreConfig,
    type DiffEntry,
    type DiffResult,
    type SerializedDiffResult,
    type JsonScalar,
    type JsonValue,
    type JsonPatchOp,
} from "./types.js";

export { applyPatch, revertPatch, toJsonPatch } from "./patch.js";
export { formatDiff } from "./format.js";
export { DiffCoreError, InvalidJsonError, EngineDestroyedError, FinalizationError } from "./errors.js";
export { buildPathIndex, foldSegment, foldIndex, decodeLeafValue } from "./path-index.js";

/** Raw WASM exports — internal use only. */
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

const engineRegistry = new FinalizationRegistry<{
    wasm: WasmExports;
    enginePtr: number;
}>((held) => {
    if (held.enginePtr !== 0) {
        try {
            held.wasm.destroy_engine(held.enginePtr);
        } catch {
            /* swallow during GC */
        }
    }
});

function serializeConfig(config: DiffCoreConfig): Uint8Array {
    const buf = new ArrayBuffer(20);
    const view = new DataView(buf);
    view.setUint32(0, config.maxMemoryBytes ?? 32 * 1024 * 1024, true);
    view.setUint32(4, config.maxInputSize ?? 64 * 1024 * 1024, true);
    view.setUint32(8, config.maxObjectKeys ?? 100_000, true);
    view.setUint8(12, config.arrayDiffMode ?? ArrayDiffMode.Index);
    view.setUint16(13, config.hashWindowSize ?? 64, true);
    view.setUint32(15, config.maxFullArraySize ?? 1024, true);
    view.setUint8(19, 0);
    return new Uint8Array(buf);
}

interface RawEntry {
    op: DiffOp;
    pathId: bigint;
    leftOffset: number;
    leftLen: number;
    rightOffset: number;
    rightLen: number;
}

function parseRawEntries(buffer: Uint8Array): { major: number; minor: number; raw: RawEntry[] } {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const major = view.getUint16(0, true);
    const minor = view.getUint16(2, true);
    const count = view.getUint32(4, true);
    const HEADER = 16;
    const ENTRY = 32;
    const raw: RawEntry[] = [];
    for (let i = 0; i < count; i++) {
        const off = HEADER + i * ENTRY;
        if (off + ENTRY > buffer.length) break;
        const op = view.getUint8(off) as DiffOp;
        const pathIdLow = view.getUint32(off + 8, true);
        const pathIdHigh = view.getUint32(off + 12, true);
        const pathId = pathIdFromU32Pair(pathIdLow, pathIdHigh);
        raw.push({
            op,
            pathId,
            leftOffset: view.getUint32(off + 16, true),
            leftLen: view.getUint32(off + 20, true),
            rightOffset: view.getUint32(off + 24, true),
            rightLen: view.getUint32(off + 28, true),
        });
    }
    return { major, minor, raw };
}

function pathMatchesFilter(path: string, filters: readonly string[]): boolean {
    for (const f of filters) {
        if (path === f) return true;
        if (path.startsWith(f + "/")) return true;
    }
    return false;
}

function applyEntryFilters(
    entries: DiffEntry[],
    ignore: readonly string[] | undefined,
    scope: string | undefined
): DiffEntry[] {
    let out = entries;
    if (scope !== undefined && scope !== "") {
        out = out.filter((e) => e.path === scope || e.path.startsWith(scope + "/"));
    }
    if (ignore && ignore.length > 0) {
        out = out.filter((e) => !pathMatchesFilter(e.path, ignore));
    }
    return out;
}

function makeSerializable(entries: DiffEntry[], major: number, minor: number): () => SerializedDiffResult {
    return () => ({
        version: { major, minor },
        entries: entries.map((e) => ({
            op: e.op,
            path: e.path,
            pathId: e.pathId.toString(16),
            leftValue: e.leftValue,
            rightValue: e.rightValue,
        })),
    });
}

function resolveEntries(
    raw: RawEntry[],
    leftBytes: Uint8Array | null,
    rightBytes: Uint8Array | null,
    resolvePaths: boolean
): DiffEntry[] {
    const leftIndex = resolvePaths && leftBytes ? buildPathIndex(leftBytes) : null;
    const rightIndex = resolvePaths && rightBytes ? buildPathIndex(rightBytes) : null;

    return raw.map((e) => {
        // Engine guarantee: Modified means both sides have a leaf at this path
        // (offset/len are valid even when len === 0, e.g. empty strings).
        // Added: only right has a leaf. Removed: only left has a leaf.
        const leftPresent  = e.op === DiffOp.Modified || e.op === DiffOp.Removed;
        const rightPresent = e.op === DiffOp.Modified || e.op === DiffOp.Added;

        let info: LeafInfo | undefined;
        if (leftPresent && leftIndex) info = leftIndex.byPathId.get(e.pathId);
        if (!info && rightPresent && rightIndex) info = rightIndex.byPathId.get(e.pathId);

        const path = info
            ? info.pointer
            : `#hash:${e.pathId.toString(16).padStart(16, "0")}`;

        let leftValue: JsonScalar | undefined;
        let rightValue: JsonScalar | undefined;
        let leftSlice: Uint8Array | undefined;
        let rightSlice: Uint8Array | undefined;

        if (leftPresent && leftBytes) {
            leftSlice = leftBytes.subarray(e.leftOffset, e.leftOffset + e.leftLen);
            if (info) leftValue = decodeLeafValue(leftBytes, { ...info, valueOffset: e.leftOffset, valueLen: e.leftLen });
            else leftValue = new TextDecoder().decode(leftSlice);
        }
        if (rightPresent && rightBytes) {
            rightSlice = rightBytes.subarray(e.rightOffset, e.rightOffset + e.rightLen);
            if (info) rightValue = decodeLeafValue(rightBytes, { ...info, valueOffset: e.rightOffset, valueLen: e.rightLen });
            else rightValue = new TextDecoder().decode(rightSlice);
        }

        return {
            op: e.op,
            path,
            pathId: e.pathId,
            leftValue,
            rightValue,
            leftBytes: leftSlice,
            rightBytes: rightSlice,
        };
    });
}

/**
 * Streaming engine. Push left and right inputs in chunks, then `finalize()`.
 * Memory is freed automatically when the engine is garbage collected.
 *
 * @example
 * ```ts
 * const engine = await createEngine();
 * engine.pushLeft(new TextEncoder().encode('{"a":1}'));
 * engine.pushRight(new TextEncoder().encode('{"a":2}'));
 * const result = engine.finalize();
 * ```
 */
export class DiffEngine {
    private wasm: WasmExports;
    private enginePtr = 0;
    private destroyed = false;
    private leftInputPtr = 0;
    private rightInputPtr = 0;
    private leftWritten = 0;
    private rightWritten = 0;
    private committed = false;
    private resolvePaths: boolean;
    private ignore?: readonly string[];
    private scope?: string;
    private leftBuffer: Uint8Array[] = [];
    private rightBuffer: Uint8Array[] = [];
    /** Per-side input capacity in bytes (the engine splits `maxInputSize` in two). */
    private sideCapacity: number;

    /** @internal use `createEngine()`. */
    constructor(wasm: WasmExports, config: DiffCoreConfig = {}) {
        this.wasm = wasm;
        this.resolvePaths = config.resolvePaths !== false;
        this.ignore = config.ignore;
        this.scope = config.scope;
        this.sideCapacity = Math.floor((config.maxInputSize ?? 64 * 1024 * 1024) / 2);
        const configBytes = serializeConfig(config);
        const configPtr = this.allocAndWrite(configBytes);
        this.enginePtr = wasm.create_engine(configPtr, configBytes.length);
        if (this.enginePtr === 0) {
            throw new DiffCoreError("failed to create engine — config may be invalid");
        }
        this.leftInputPtr = wasm.get_left_input_ptr(this.enginePtr);
        this.rightInputPtr = wasm.get_right_input_ptr(this.enginePtr);
        engineRegistry.register(this, { wasm, enginePtr: this.enginePtr }, this);
    }

    private allocAndWrite(data: Uint8Array): number {
        const ptr = 1024;
        new Uint8Array(this.wasm.memory.buffer).set(data, ptr);
        return ptr;
    }

    /**
     * Push a chunk of the left (original) JSON document.
     *
     * Chunks accumulate into a WASM-managed buffer; the document is parsed
     * once, on `finalize()`. Returns `Status.Error` only if the chunk would
     * overflow the per-side input capacity (`maxInputSize / 2`).
     */
    pushLeft(chunk: Uint8Array): Status {
        if (this.destroyed) throw new EngineDestroyedError();
        if (this.committed) throw new DiffCoreError("cannot push after finalize()");
        if (this.leftInputPtr === 0) throw new DiffCoreError("left input buffer not available");
        if (this.leftWritten + chunk.length > this.sideCapacity) return Status.Error;
        new Uint8Array(this.wasm.memory.buffer).set(chunk, this.leftInputPtr + this.leftWritten);
        this.leftWritten += chunk.length;
        if (this.resolvePaths) this.leftBuffer.push(chunk.slice());
        return Status.Ok;
    }

    /** Push a chunk of the right (modified) JSON document. See {@link pushLeft}. */
    pushRight(chunk: Uint8Array): Status {
        if (this.destroyed) throw new EngineDestroyedError();
        if (this.committed) throw new DiffCoreError("cannot push after finalize()");
        if (this.rightInputPtr === 0) throw new DiffCoreError("right input buffer not available");
        if (this.rightWritten + chunk.length > this.sideCapacity) return Status.Error;
        new Uint8Array(this.wasm.memory.buffer).set(chunk, this.rightInputPtr + this.rightWritten);
        this.rightWritten += chunk.length;
        if (this.resolvePaths) this.rightBuffer.push(chunk.slice());
        return Status.Ok;
    }

    /** Finalize the diff and return resolved entries. */
    finalize(): DiffResult {
        if (this.destroyed) throw new EngineDestroyedError();
        // Commit both sides exactly once, as a single contiguous parse.
        // Per-chunk commits would re-parse from offset 0 every time and
        // corrupt multi-chunk streams — so the parse is deferred to here.
        if (!this.committed) {
            this.committed = true;
            const ls = this.wasm.commit_left(this.enginePtr, this.leftWritten);
            if (ls !== Status.Ok) {
                throw new FinalizationError(`left input rejected (status ${ls})`);
            }
            const rs = this.wasm.commit_right(this.enginePtr, this.rightWritten);
            if (rs !== Status.Ok) {
                throw new FinalizationError(`right input rejected (status ${rs})`);
            }
        }
        const resultPtr = this.wasm.finalize(this.enginePtr);
        if (resultPtr === 0) {
            const errorPtr = this.wasm.get_last_error(this.enginePtr);
            const errorLen = this.wasm.get_last_error_len(this.enginePtr);
            let detail: string | undefined;
            if (errorPtr !== 0 && errorLen > 0) {
                detail = new TextDecoder().decode(
                    new Uint8Array(this.wasm.memory.buffer, errorPtr, errorLen)
                );
            }
            throw new FinalizationError(detail);
        }
        const resultLen = this.wasm.get_result_len(this.enginePtr);
        const resultCopy = new Uint8Array(resultLen);
        resultCopy.set(new Uint8Array(this.wasm.memory.buffer, resultPtr, resultLen));

        const { major, minor, raw } = parseRawEntries(resultCopy);
        const left = this.resolvePaths ? concatChunks(this.leftBuffer) : null;
        const right = this.resolvePaths ? concatChunks(this.rightBuffer) : null;
        let entries = resolveEntries(raw, left, right, this.resolvePaths);
        entries = applyEntryFilters(entries, this.ignore, this.scope);

        return {
            version: { major, minor },
            entries,
            raw: resultCopy,
            toJSON: makeSerializable(entries, major, minor),
        };
    }

    /** Free WASM memory immediately. Optional — GC handles it otherwise. */
    destroy(): void {
        if (!this.destroyed && this.enginePtr !== 0) {
            engineRegistry.unregister(this);
            this.wasm.destroy_engine(this.enginePtr);
            this.enginePtr = 0;
            this.destroyed = true;
            this.leftBuffer = [];
            this.rightBuffer = [];
        }
    }

    get isDestroyed(): boolean {
        return this.destroyed;
    }

    /** Last error message from the engine, if any. */
    getLastError(): string | null {
        if (this.destroyed) return null;
        const errorPtr = this.wasm.get_last_error(this.enginePtr);
        const errorLen = this.wasm.get_last_error_len(this.enginePtr);
        if (errorPtr === 0 || errorLen === 0) return null;
        return new TextDecoder().decode(
            new Uint8Array(this.wasm.memory.buffer, errorPtr, errorLen)
        );
    }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) return new Uint8Array(0);
    if (chunks.length === 1) return chunks[0];
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.length;
    }
    return out;
}

let cachedWasmModule: WebAssembly.Module | null = null;

async function loadEmbeddedWasm(): Promise<WebAssembly.Module> {
    if (cachedWasmModule) return cachedWasmModule;
    const { getWasmModule } = await import("./wasm-embedded.js");
    cachedWasmModule = await getWasmModule();
    return cachedWasmModule;
}

/**
 * Create an engine for streaming use. The WASM module is loaded automatically
 * and cached across calls.
 */
export async function createEngine(config: DiffCoreConfig = {}): Promise<DiffEngine> {
    const module = await loadEmbeddedWasm();
    const instance = await WebAssembly.instantiate(module, { env: {} });
    return new DiffEngine(instance.exports as unknown as WasmExports, config);
}

/** Advanced: create an engine from a custom WASM source (URL / bytes / module). */
export async function createEngineWithWasm(
    wasmSource: string | URL | ArrayBuffer | WebAssembly.Module,
    config: DiffCoreConfig = {}
): Promise<DiffEngine> {
    const module = await loadWasmModule(wasmSource);
    const instance = await WebAssembly.instantiate(module, { env: {} });
    return new DiffEngine(instance.exports as unknown as WasmExports, config);
}

async function loadWasmModule(
    source: string | URL | ArrayBuffer | WebAssembly.Module
): Promise<WebAssembly.Module> {
    if (source instanceof WebAssembly.Module) return source;
    if (source instanceof ArrayBuffer) return WebAssembly.compile(source);
    const isNode =
        typeof globalThis === "object" &&
        "process" in globalThis &&
        Boolean((globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node);
    if (isNode) {
        const fs = await import("fs/promises");
        const path = source instanceof URL ? source.pathname : source.toString();
        const buffer = await fs.readFile(path);
        return WebAssembly.compile(buffer);
    }
    const url = source instanceof URL ? source : new URL(source, import.meta.url);
    const response = await fetch(url);
    if (typeof WebAssembly.compileStreaming === "function") {
        return WebAssembly.compileStreaming(response);
    }
    const buffer = await response.arrayBuffer();
    return WebAssembly.compile(buffer);
}

/**
 * One-shot diff. The simplest entry point.
 *
 * @example
 * ```ts
 * const result = await diff(oldJson, newJson);
 * for (const e of result.entries) {
 *   console.log(`${DiffOp[e.op]} ${e.path}`, e.leftValue, '→', e.rightValue);
 * }
 * ```
 */
export async function diff(
    left: Uint8Array | string,
    right: Uint8Array | string,
    config: DiffCoreConfig = {}
): Promise<DiffResult> {
    const resolvePaths = config.resolvePaths !== false;

    // Validate inputs up front so callers get a clear error instead of a
    // silently-empty or misaligned diff from the lenient WASM parser.
    const leftBytes = typeof left === "string" ? new TextEncoder().encode(left) : left;
    const rightBytes = typeof right === "string" ? new TextEncoder().encode(right) : right;
    const leftText = typeof left === "string" ? left : new TextDecoder().decode(left);
    const rightText = typeof right === "string" ? right : new TextDecoder().decode(right);
    try {
        JSON.parse(leftText);
    } catch (e) {
        throw new InvalidJsonError("left", Status.Error, (e as Error).message);
    }
    try {
        JSON.parse(rightText);
    } catch (e) {
        throw new InvalidJsonError("right", Status.Error, (e as Error).message);
    }

    const engine = await createEngine({ ...config, resolvePaths: false });

    try {
        const leftStatus = engine.pushLeft(leftBytes);
        if (leftStatus !== Status.Ok) throw new InvalidJsonError("left", leftStatus);

        const rightStatus = engine.pushRight(rightBytes);
        if (rightStatus !== Status.Ok) throw new InvalidJsonError("right", rightStatus);

        const result = engine.finalize();
        const { major, minor, raw } = parseRawEntries(result.raw);
        let entries = resolveEntries(raw, leftBytes, rightBytes, resolvePaths);
        entries = applyEntryFilters(entries, config.ignore, config.scope);
        return {
            version: result.version,
            entries,
            raw: result.raw,
            toJSON: makeSerializable(entries, major, minor),
        };
    } finally {
        engine.destroy();
    }
}

/**
 * Returns `true` if `a` and `b` are structurally equal (no differences after
 * applying any `ignore` / `scope` filters).
 *
 * Short-circuits on reference equality. For everything else, runs the same
 * engine pass `diff()` does, then checks `entries.length === 0`.
 *
 * @example
 * ```ts
 * if (await equals(prev, next)) return;            // nothing changed
 * if (await equals(a, b, { ignore: ["/timestamp"] })) // ignore noise
 * ```
 */
export async function equals(
    left: Uint8Array | string,
    right: Uint8Array | string,
    config: DiffCoreConfig = {}
): Promise<boolean> {
    if (left === right) return true;
    if (typeof left === "string" && typeof right === "string" && left === right) return true;
    const result = await diff(left, right, config);
    return result.entries.length === 0;
}
