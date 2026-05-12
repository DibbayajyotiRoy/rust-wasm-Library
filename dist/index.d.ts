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
import { Status, type DiffCoreConfig, type DiffResult } from "./types.js";
export { Status, DiffOp, ArrayDiffMode, EDGE_CONFIG, type DiffCoreConfig, type DiffEntry, type DiffResult, type SerializedDiffResult, type JsonScalar, type JsonValue, type JsonPatchOp, } from "./types.js";
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
export declare class DiffEngine {
    private wasm;
    private enginePtr;
    private destroyed;
    private leftInputPtr;
    private rightInputPtr;
    private leftWritten;
    private rightWritten;
    private resolvePaths;
    private ignore?;
    private scope?;
    private leftBuffer;
    private rightBuffer;
    /** @internal use `createEngine()`. */
    constructor(wasm: WasmExports, config?: DiffCoreConfig);
    private allocAndWrite;
    /** Push a chunk of the left (original) JSON document. */
    pushLeft(chunk: Uint8Array): Status;
    /** Push a chunk of the right (modified) JSON document. */
    pushRight(chunk: Uint8Array): Status;
    /** Finalize the diff and return resolved entries. */
    finalize(): DiffResult;
    /** Free WASM memory immediately. Optional — GC handles it otherwise. */
    destroy(): void;
    get isDestroyed(): boolean;
    /** Last error message from the engine, if any. */
    getLastError(): string | null;
}
/**
 * Create an engine for streaming use. The WASM module is loaded automatically
 * and cached across calls.
 */
export declare function createEngine(config?: DiffCoreConfig): Promise<DiffEngine>;
/** Advanced: create an engine from a custom WASM source (URL / bytes / module). */
export declare function createEngineWithWasm(wasmSource: string | URL | ArrayBuffer | WebAssembly.Module, config?: DiffCoreConfig): Promise<DiffEngine>;
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
export declare function diff(left: Uint8Array | string, right: Uint8Array | string, config?: DiffCoreConfig): Promise<DiffResult>;
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
export declare function equals(left: Uint8Array | string, right: Uint8Array | string, config?: DiffCoreConfig): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map