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
export var Status;
(function (Status) {
    Status[Status["Ok"] = 0] = "Ok";
    Status[Status["NeedFlush"] = 1] = "NeedFlush";
    Status[Status["InputLimitExceeded"] = 2] = "InputLimitExceeded";
    Status[Status["EngineSealed"] = 3] = "EngineSealed";
    Status[Status["InvalidHandle"] = 4] = "InvalidHandle";
    Status[Status["ObjectKeyLimitExceeded"] = 5] = "ObjectKeyLimitExceeded";
    Status[Status["ArrayTooLarge"] = 6] = "ArrayTooLarge";
    Status[Status["Error"] = 255] = "Error";
})(Status || (Status = {}));
/** Array diff strategy */
export var ArrayDiffMode;
(function (ArrayDiffMode) {
    /** Position-based only (fast, no reorder detection) */
    ArrayDiffMode[ArrayDiffMode["Index"] = 0] = "Index";
    /** Rolling hash window (detects insertions/deletions) */
    ArrayDiffMode[ArrayDiffMode["HashWindow"] = 1] = "HashWindow";
    /** Full buffer with LCS (semantic reordering, small arrays only) */
    ArrayDiffMode[ArrayDiffMode["Full"] = 2] = "Full";
})(ArrayDiffMode || (ArrayDiffMode = {}));
/** Diff operation type */
export var DiffOp;
(function (DiffOp) {
    DiffOp[DiffOp["Added"] = 0] = "Added";
    DiffOp[DiffOp["Removed"] = 1] = "Removed";
    DiffOp[DiffOp["Modified"] = 2] = "Modified";
})(DiffOp || (DiffOp = {}));
/** Edge runtime optimized config */
export const EDGE_CONFIG = {
    maxMemoryBytes: 16 * 1024 * 1024,
    maxInputSize: 32 * 1024 * 1024,
    maxObjectKeys: 50_000,
    arrayDiffMode: ArrayDiffMode.Index,
    hashWindowSize: 32,
    maxFullArraySize: 512,
};
//# sourceMappingURL=types.js.map