/**
 * State-management primitives built on top of `diff` / `applyPatch`.
 *
 * - `createHistory()` — undo/redo stack with bounded size
 * - `detectConflicts()` — find paths edited by two patches
 * - `merge3()` — three-way merge with conflict reporting
 * - `dateTolerance()` / `numericTolerance()` — custom comparators
 *
 * Everything in this module is pure JS — no WASM. It composes the engine via
 * the public `diff` / `applyPatch` API.
 */
import { DiffOp, type DiffCoreConfig, type DiffEntry, type DiffResult, type JsonValue } from "./types.js";
export interface History<T extends JsonValue> {
    /** Current state. */
    readonly current: T;
    /** Replace current state and push the previous state onto the undo stack. */
    push(next: T): Promise<void>;
    /** Step backward. Returns the new current state, or `null` if nothing to undo. */
    undo(): T | null;
    /** Step forward. Returns the new current state, or `null` if nothing to redo. */
    redo(): T | null;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Number of patches that can still be undone. */
    size(): number;
}
/**
 * Create an undo/redo stack that stores **patches**, not full snapshots.
 * Memory cost is O(changed-bytes), not O(state-size × history-depth).
 *
 * @example
 * ```ts
 * const history = createHistory({ count: 0, todos: [] });
 * await history.push({ count: 1, todos: [{ text: "hi" }] });
 * await history.push({ count: 2, todos: [{ text: "hi" }, { text: "bye" }] });
 * history.undo();        // count: 1, todos: [{ text: "hi" }]
 * history.undo();        // count: 0, todos: []
 * history.redo();        // count: 1, todos: [{ text: "hi" }]
 * ```
 */
export declare function createHistory<T extends JsonValue>(initial: T, options?: {
    maxSize?: number;
}): History<T>;
export interface Conflict {
    /** JSON Pointer path edited by both sides. */
    path: string;
    /** What patch A did at this path. */
    a: {
        op: DiffOp;
        value?: JsonValue;
    };
    /** What patch B did at this path. */
    b: {
        op: DiffOp;
        value?: JsonValue;
    };
    /** `true` if both sides ended up writing the same value. */
    sameOutcome: boolean;
}
/**
 * Find every path edited by both patches. A conflict is **any** path written
 * by both sides — even if both wrote the same value (callers can choose to
 * accept those via `sameOutcome`).
 *
 * @example
 * ```ts
 * const a = await diff(base, branchA);
 * const b = await diff(base, branchB);
 * for (const c of detectConflicts(a, b)) {
 *   console.log(c.path, c.a.value, c.b.value);
 * }
 * ```
 */
export declare function detectConflicts(patchA: DiffResult | DiffEntry[], patchB: DiffResult | DiffEntry[]): Conflict[];
export type MergeStrategy = "prefer-a" | "prefer-b" | "throw";
export interface MergeResult<T extends JsonValue> {
    /** The merged value. */
    value: T;
    /** Paths where both sides edited; resolution applied per `strategy`. */
    conflicts: Conflict[];
}
/**
 * Three-way merge: apply both `a`'s and `b`'s changes to `base`. Non-conflicting
 * edits both apply; conflicting paths are resolved by the chosen `strategy`.
 *
 * @example
 * ```ts
 * const result = await merge3(base, branchA, branchB, { strategy: "prefer-a" });
 * if (result.conflicts.length > 0) console.warn("conflicts at:", result.conflicts.map(c => c.path));
 * console.log(result.value);
 * ```
 */
export declare function merge3<T extends JsonValue>(base: T, a: T, b: T, options?: {
    strategy?: MergeStrategy;
    config?: DiffCoreConfig;
}): Promise<MergeResult<T>>;
export declare class MergeConflictError extends Error {
    readonly conflicts: Conflict[];
    constructor(conflicts: Conflict[]);
}
/**
 * Returns a list of JSON Pointer paths that the two values disagree on,
 * ignoring values that pass any of the supplied comparator predicates.
 *
 * Useful for "treat dates as equal if within N ms" or "treat numbers as equal
 * if within ε" style checks. Reuses the engine for raw structural diff, then
 * filters JS-side.
 *
 * @example
 * ```ts
 * const noisy = await diffWith(a, b, {
 *   "/createdAt": dateTolerance(1000),
 *   "/score": numericTolerance(0.01),
 * });
 * ```
 */
export declare function diffWith(left: Uint8Array | string, right: Uint8Array | string, comparators: Record<string, Comparator>, config?: DiffCoreConfig): Promise<DiffResult>;
export type Comparator = (a: unknown, b: unknown) => boolean;
/** Returns true if both values parse as dates within `toleranceMs` milliseconds. */
export declare function dateTolerance(toleranceMs: number): Comparator;
/** Returns true if both values are numbers within `epsilon`. */
export declare function numericTolerance(epsilon: number): Comparator;
/** Returns true if both values are strings that compare equal case-insensitively. */
export declare function caseInsensitive(): Comparator;
//# sourceMappingURL=state.d.ts.map