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
import { diff } from "./index.js";
import { applyPatch } from "./patch.js";
import { DiffOp, } from "./types.js";
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
export function createHistory(initial, options = {}) {
    const maxSize = options.maxSize ?? 100;
    let current = clone(initial);
    const undoStack = []; // patches that, applied to `current`, give the *previous* state
    const redoStack = []; // patches that, applied to `current`, give the *next* state
    async function push(next) {
        const forward = await diff(JSON.stringify(current), JSON.stringify(next));
        if (forward.entries.length === 0)
            return;
        // The undo-patch is the *reverse*: applied to `next` it must produce `current`.
        const backward = await diff(JSON.stringify(next), JSON.stringify(current));
        undoStack.push(backward);
        if (undoStack.length > maxSize)
            undoStack.shift();
        redoStack.length = 0;
        current = clone(next);
    }
    function undo() {
        const patch = undoStack.pop();
        if (!patch)
            return null;
        const previous = applyPatch(current, patch);
        // Build the forward (redo) patch from previous → current.
        // We have current's diff against previous already implicit, but a clean
        // approach is to recompute synchronously by inverting `patch`.
        const redoPatch = invertSync(patch);
        redoStack.push(redoPatch);
        current = previous;
        return current;
    }
    function redo() {
        const patch = redoStack.pop();
        if (!patch)
            return null;
        const next = applyPatch(current, patch);
        const undoPatch = invertSync(patch);
        undoStack.push(undoPatch);
        current = next;
        return current;
    }
    return {
        get current() { return current; },
        push,
        undo,
        redo,
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        size: () => undoStack.length,
    };
}
function invertSync(patch) {
    const flipped = patch.entries.map((e) => ({
        ...e,
        op: e.op === DiffOp.Added
            ? DiffOp.Removed
            : e.op === DiffOp.Removed
                ? DiffOp.Added
                : DiffOp.Modified,
        leftValue: e.rightValue,
        rightValue: e.leftValue,
        leftBytes: e.rightBytes,
        rightBytes: e.leftBytes,
    }));
    return { ...patch, entries: flipped };
}
function clone(v) {
    if (v === null || typeof v !== "object")
        return v;
    return JSON.parse(JSON.stringify(v));
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
export function detectConflicts(patchA, patchB) {
    const aEntries = Array.isArray(patchA) ? patchA : patchA.entries;
    const bEntries = Array.isArray(patchB) ? patchB : patchB.entries;
    const bByPath = new Map(bEntries.map((e) => [e.path, e]));
    const conflicts = [];
    for (const a of aEntries) {
        const b = bByPath.get(a.path);
        if (!b)
            continue;
        const aValue = a.rightValue;
        const bValue = b.rightValue;
        const sameOutcome = a.op === b.op && JSON.stringify(aValue) === JSON.stringify(bValue);
        conflicts.push({
            path: a.path,
            a: { op: a.op, value: aValue },
            b: { op: b.op, value: bValue },
            sameOutcome,
        });
    }
    return conflicts;
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
export async function merge3(base, a, b, options = {}) {
    const strategy = options.strategy ?? "throw";
    const patchA = await diff(JSON.stringify(base), JSON.stringify(a), options.config);
    const patchB = await diff(JSON.stringify(base), JSON.stringify(b), options.config);
    const conflicts = detectConflicts(patchA, patchB);
    const conflictPaths = new Set(conflicts.map((c) => c.path));
    // If `throw` and any real conflict exists (not just `sameOutcome`), bail.
    if (strategy === "throw") {
        const real = conflicts.filter((c) => !c.sameOutcome);
        if (real.length > 0) {
            throw new MergeConflictError(real);
        }
    }
    // Apply non-conflicting B edits first, then conflict-resolved edits.
    const nonConflictingB = patchB.entries.filter((e) => !conflictPaths.has(e.path));
    let value = applyPatch(base, patchA, { lenient: true });
    value = applyPatch(value, nonConflictingB, { lenient: true });
    if (strategy === "prefer-b") {
        const conflictingB = patchB.entries.filter((e) => conflictPaths.has(e.path));
        value = applyPatch(value, conflictingB, { lenient: true });
    }
    // "prefer-a" already applied via patchA above.
    return { value, conflicts };
}
export class MergeConflictError extends Error {
    conflicts;
    constructor(conflicts) {
        super(`merge3: ${conflicts.length} conflict(s) at ${conflicts.map((c) => c.path).join(", ")}`);
        this.conflicts = conflicts;
        this.name = "MergeConflictError";
    }
}
// ============================================================================
// Custom comparators (helpers for ignore / tolerance patterns)
// ============================================================================
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
export async function diffWith(left, right, comparators, config = {}) {
    const base = await diff(left, right, config);
    const filtered = base.entries.filter((e) => {
        const cmp = comparators[e.path];
        if (!cmp)
            return true;
        return !cmp(e.leftValue, e.rightValue);
    });
    return {
        ...base,
        entries: filtered,
        toJSON: () => ({
            version: base.version,
            entries: filtered.map((e) => ({
                op: e.op,
                path: e.path,
                pathId: e.pathId.toString(16),
                leftValue: e.leftValue,
                rightValue: e.rightValue,
            })),
        }),
    };
}
/** Returns true if both values parse as dates within `toleranceMs` milliseconds. */
export function dateTolerance(toleranceMs) {
    return (a, b) => {
        const da = parseDate(a);
        const db = parseDate(b);
        if (da === null || db === null)
            return false;
        return Math.abs(da - db) <= toleranceMs;
    };
}
/** Returns true if both values are numbers within `epsilon`. */
export function numericTolerance(epsilon) {
    return (a, b) => {
        if (typeof a !== "number" || typeof b !== "number")
            return false;
        return Math.abs(a - b) <= epsilon;
    };
}
/** Returns true if both values are strings that compare equal case-insensitively. */
export function caseInsensitive() {
    return (a, b) => {
        if (typeof a !== "string" || typeof b !== "string")
            return false;
        return a.toLowerCase() === b.toLowerCase();
    };
}
function parseDate(v) {
    if (typeof v === "number")
        return v;
    if (typeof v !== "string")
        return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
}
//# sourceMappingURL=state.js.map