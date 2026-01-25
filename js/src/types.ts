/**
 * DiffCore - High-performance streaming JSON diff engine
 * 
 * WASM-powered structural comparison with:
 * - Streaming chunk-based input
 * - Path-aware hash-assisted diffing
 * - Zero-copy memory model
 * - Backpressure via Status codes
 */

/** Status codes returned by engine operations */
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

/** Array diff strategy */
export enum ArrayDiffMode {
    /** Position-based only (fast, no reorder detection) */
    Index = 0,
    /** Rolling hash window (detects insertions/deletions) */
    HashWindow = 1,
    /** Full buffer with LCS (semantic reordering, small arrays only) */
    Full = 2,
}

/** Diff operation type */
export enum DiffOp {
    Added = 0,
    Removed = 1,
    Modified = 2,
}

/** Engine configuration with capability limits */
export interface DiffCoreConfig {
    /** Maximum memory for result arena (bytes). Default: 32MB */
    maxMemoryBytes?: number;
    /** Maximum total input size (bytes). Default: 64MB */
    maxInputSize?: number;
    /** Maximum object keys to buffer. Default: 100,000 */
    maxObjectKeys?: number;
    /** Array diff strategy. Default: Index */
    arrayDiffMode?: ArrayDiffMode;
    /** Hash window size for HashWindow mode. Default: 64 */
    hashWindowSize?: number;
    /** Maximum array size for Full mode. Default: 1024 */
    maxFullArraySize?: number;
}

/** Edge runtime optimized config */
export const EDGE_CONFIG: DiffCoreConfig = {
    maxMemoryBytes: 16 * 1024 * 1024,
    maxInputSize: 32 * 1024 * 1024,
    maxObjectKeys: 50_000,
    arrayDiffMode: ArrayDiffMode.Index,
    hashWindowSize: 32,
    maxFullArraySize: 512,
};

/** A single diff entry */
export interface DiffEntry {
    op: DiffOp;
    path: string;
    leftValue?: Uint8Array;
    rightValue?: Uint8Array;
}

/** Diff result with parsed entries */
export interface DiffResult {
    version: { major: number; minor: number };
    entries: DiffEntry[];
    raw: Uint8Array;
}
