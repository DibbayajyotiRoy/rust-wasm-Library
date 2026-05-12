/**
 * DiffCore - High-performance streaming JSON diff engine
 *
 * Public types. The runtime API resolves paths to JSON Pointers and values
 * back to JS primitives by walking the input bytes alongside the WASM diff.
 */

/** Status codes returned by engine operations. */
export enum Status {
    Ok = 0,
    NeedFlush = 1,
    InputLimitExceeded = 2,
    EngineSealed = 3,
    InvalidHandle = 4,
    ObjectKeyLimitExceeded = 5,
    ArrayTooLarge = 6,
    Error = 255,
}

/** Array diff strategy. */
export enum ArrayDiffMode {
    /** Position-based only (fast, no reorder detection). */
    Index = 0,
    /** Rolling hash window (detects insertions / deletions). */
    HashWindow = 1,
    /** Full buffer with LCS (semantic reordering, small arrays only). */
    Full = 2,
}

/** Diff operation type. */
export enum DiffOp {
    Added = 0,
    Removed = 1,
    Modified = 2,
}

/** Engine configuration with capability limits. */
export interface DiffCoreConfig {
    /** Maximum memory for result arena (bytes). Default: 32MB. */
    maxMemoryBytes?: number;
    /** Maximum total input size (bytes). Default: 64MB. */
    maxInputSize?: number;
    /** Maximum object keys to buffer. Default: 100,000. */
    maxObjectKeys?: number;
    /** Array diff strategy. Default: Index. */
    arrayDiffMode?: ArrayDiffMode;
    /** Hash window size for HashWindow mode. Default: 64. */
    hashWindowSize?: number;
    /** Maximum array size for Full mode. Default: 1024. */
    maxFullArraySize?: number;
    /**
     * Resolve `path` strings to real JSON Pointers and decode `value` fields.
     * Adds a small one-pass JS walk over each input. Default: true.
     * Set to false for raw-hash paths (slightly faster, rarely useful).
     */
    resolvePaths?: boolean;
    /**
     * Drop entries whose `path` matches one of these JSON Pointer strings or
     * starts with one of them followed by `/`. Useful for ignoring noisy
     * fields like `/timestamp`, `/_id`, or `/__meta`.
     *
     * @example
     * ```ts
     * await diff(a, b, { ignore: ["/fetchedAt", "/_id"] });
     * ```
     */
    ignore?: readonly string[];
    /**
     * Restrict the diff to entries whose `path` starts with this JSON Pointer.
     * Useful when you only care about changes under one subtree.
     *
     * @example
     * ```ts
     * await diff(a, b, { scope: "/users" });   // only entries under /users
     * ```
     */
    scope?: string;
}

/** Edge-runtime-optimized config. */
export const EDGE_CONFIG: DiffCoreConfig = {
    maxMemoryBytes: 16 * 1024 * 1024,
    maxInputSize: 32 * 1024 * 1024,
    maxObjectKeys: 50_000,
    arrayDiffMode: ArrayDiffMode.Index,
    hashWindowSize: 32,
    maxFullArraySize: 512,
};

/**
 * A single diff entry. By default the engine resolves paths and values for
 * you; the raw bytes and hash are still exposed for advanced consumers.
 */
export interface DiffEntry {
    /** Add / Remove / Modify. */
    op: DiffOp;
    /** JSON Pointer (RFC 6901), e.g. `/users/0/name`. Empty string for the document root. */
    path: string;
    /** Decoded left-hand value (null for `Added`). */
    leftValue?: JsonScalar;
    /** Decoded right-hand value (null for `Removed`). */
    rightValue?: JsonScalar;
    /** Raw left bytes from the original input (unparsed). */
    leftBytes?: Uint8Array;
    /** Raw right bytes from the original input (unparsed). */
    rightBytes?: Uint8Array;
    /** Engine path hash (FNV-1a). Use this for fast equality checks. */
    pathId: bigint;
}

/** Leaf-level JSON values that the engine compares. */
export type JsonScalar = string | number | boolean | null;

/** A standalone JSON value tree (used by patch helpers). */
export type JsonValue =
    | JsonScalar
    | JsonValue[]
    | { [k: string]: JsonValue };

/** Diff result with structured entries. */
export interface DiffResult {
    version: { major: number; minor: number };
    entries: DiffEntry[];
    /** Raw result buffer from the engine — opaque, exposed for tooling. */
    raw: Uint8Array;
    /**
     * Convert to a `JSON.stringify`-safe plain object. `bigint` `pathId`s become
     * hex strings; `raw` and per-entry byte buffers are omitted by default.
     *
     * @example
     * ```ts
     * const result = await diff(a, b);
     * const payload = JSON.stringify(result.toJSON());   // safe to send over the wire
     * ```
     */
    toJSON(): SerializedDiffResult;
}

/** Wire-safe form of `DiffResult` (no `bigint`, no `Uint8Array`). */
export interface SerializedDiffResult {
    version: { major: number; minor: number };
    entries: Array<{
        op: DiffOp;
        path: string;
        pathId: string;
        leftValue?: JsonScalar;
        rightValue?: JsonScalar;
    }>;
}

/** RFC 6902 JSON Patch operation. */
export type JsonPatchOp =
    | { op: "add"; path: string; value: JsonValue }
    | { op: "remove"; path: string }
    | { op: "replace"; path: string; value: JsonValue }
    | { op: "move"; path: string; from: string }
    | { op: "copy"; path: string; from: string }
    | { op: "test"; path: string; value: JsonValue };
