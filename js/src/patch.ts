/**
 * Patch helpers: apply a diff to a JSON value, revert it, or emit it as
 * standard RFC 6902 JSON Patch. These operate on the resolved `DiffResult`
 * produced by `diff()` — no WASM needed at this layer.
 */

import {
    DiffOp,
    type DiffEntry,
    type DiffResult,
    type JsonPatchOp,
    type JsonScalar,
    type JsonValue,
} from "./types.js";

/** Decode an RFC 6901 JSON Pointer into its segments. */
function pointerSegments(pointer: string): string[] {
    if (pointer === "") return [];
    if (pointer[0] !== "/")
        throw new Error(`invalid JSON Pointer (must start with '/' or be empty): ${pointer}`);
    return pointer
        .slice(1)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function isArrayIndex(seg: string): boolean {
    return seg === "-" || /^(0|[1-9][0-9]*)$/.test(seg);
}

function clone<T extends JsonValue>(v: T): T {
    if (v === null || typeof v !== "object") return v;
    return JSON.parse(JSON.stringify(v));
}

/**
 * Resolve a JSON Pointer to its parent container and the final segment.
 * Returns `null` if the path is unreachable.
 */
function navigateParent(
    root: JsonValue,
    segments: string[],
    createMissing: boolean
): { parent: JsonValue; key: string } | null {
    if (segments.length === 0) return null;
    let node: JsonValue = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (Array.isArray(node)) {
            if (!isArrayIndex(seg)) return null;
            const idx = seg === "-" ? node.length : Number(seg);
            if (idx < 0 || idx >= node.length) {
                if (!createMissing) return null;
                while (node.length <= idx) node.push({} as JsonValue);
            }
            node = node[idx];
        } else if (node !== null && typeof node === "object") {
            if (!(seg in node)) {
                if (!createMissing) return null;
                (node as Record<string, JsonValue>)[seg] = {};
            }
            node = (node as Record<string, JsonValue>)[seg];
        } else {
            return null;
        }
    }
    return { parent: node, key: segments[segments.length - 1] };
}

/**
 * Apply a diff to a JSON value, returning a new (cloned) value with the
 * right-side changes applied. Throws on unreachable paths unless `lenient`.
 *
 * @example
 * ```ts
 * const result = await diff(oldDoc, newDoc);
 * const reconstructed = applyPatch(JSON.parse(oldDoc), result);
 * // reconstructed deep-equals JSON.parse(newDoc)
 * ```
 */
export function applyPatch<T extends JsonValue>(
    target: T,
    diff: DiffResult | DiffEntry[],
    options: { lenient?: boolean } = {}
): T {
    const entries = Array.isArray(diff) ? diff : diff.entries;
    const out = clone(target);
    const lenient = options.lenient ?? false;
    for (const e of entries) {
        const segs = pointerSegments(e.path);
        if (segs.length === 0) {
            // Root replace
            if (e.op === DiffOp.Removed) {
                // nothing meaningful at root removal — leave as-is
                continue;
            }
            return (e.rightValue ?? null) as T;
        }
        const nav = navigateParent(out, segs, e.op === DiffOp.Added);
        if (!nav) {
            if (lenient) continue;
            throw new Error(`applyPatch: unreachable path ${e.path}`);
        }
        const { parent, key } = nav;
        if (Array.isArray(parent)) {
            if (!isArrayIndex(key)) {
                if (lenient) continue;
                throw new Error(`applyPatch: non-numeric index in array path ${e.path}`);
            }
            const idx = key === "-" ? parent.length : Number(key);
            if (e.op === DiffOp.Removed) {
                parent.splice(idx, 1);
            } else if (e.op === DiffOp.Added) {
                parent.splice(idx, 0, (e.rightValue ?? null) as JsonValue);
            } else {
                parent[idx] = (e.rightValue ?? null) as JsonValue;
            }
        } else if (parent !== null && typeof parent === "object") {
            const obj = parent as Record<string, JsonValue>;
            if (e.op === DiffOp.Removed) {
                delete obj[key];
            } else {
                obj[key] = (e.rightValue ?? null) as JsonValue;
            }
        } else if (!lenient) {
            throw new Error(`applyPatch: cannot descend into scalar at ${e.path}`);
        }
    }
    return out;
}

/**
 * Identify "fully-added" array elements — pointers like `/users/2` whose
 * descendants are *all* Added entries (i.e., the whole element is new).
 * Used by `revertPatch` to remove the entire element instead of stripping its
 * leaves one-by-one (which would leave an empty `{}` shell behind).
 */
function findFullyAddedArrayElements(entries: DiffEntry[]): Set<string> {
    const result = new Set<string>();
    const allAddPaths = entries.filter((e) => e.op === DiffOp.Added).map((e) => e.path);
    const nonAddPaths = entries.filter((e) => e.op !== DiffOp.Added).map((e) => e.path);
    const candidateAncestors = new Set<string>();
    for (const p of allAddPaths) {
        const segs = p.split("/");
        for (let i = 2; i < segs.length; i++) {
            if (/^\d+$/.test(segs[i])) {
                candidateAncestors.add(segs.slice(0, i + 1).join("/"));
            }
        }
    }
    for (const ancestor of candidateAncestors) {
        const prefix = ancestor + "/";
        if (nonAddPaths.some((p) => p === ancestor || p.startsWith(prefix))) continue;
        result.add(ancestor);
    }
    return result;
}

/**
 * Revert a diff against a value (i.e. swap left ↔ right). Useful for undo.
 *
 * `revertPatch(diff(a, b))` ∘ `b` produces `a` for the common patterns:
 *   - primitive changes
 *   - leaf additions / removals (single key, single array index)
 *   - whole-array-element additions (e.g. appending a new `{id, name, …}` to
 *     an array — reverted by splicing the element, not stripping its leaves)
 *
 * @example
 * ```ts
 * const result = await diff(oldDoc, newDoc);
 * const undone = revertPatch(JSON.parse(newDoc), result);
 * // undone deep-equals JSON.parse(oldDoc)
 * ```
 */
export function revertPatch<T extends JsonValue>(
    target: T,
    diff: DiffResult | DiffEntry[],
    options: { lenient?: boolean } = {}
): T {
    const entries = Array.isArray(diff) ? diff : diff.entries;
    const fullyAdded = findFullyAddedArrayElements(entries);

    // Group Added leaves by their fully-added element root, so the whole
    // element is removed once instead of leaf-by-leaf.
    const consumedByGroup = new Set<DiffEntry>();
    const flipped: DiffEntry[] = [];

    for (const e of entries) {
        if (e.op === DiffOp.Added) {
            const root = [...fullyAdded].find((r) => e.path === r || e.path.startsWith(r + "/"));
            if (root) {
                if (consumedByGroup.has(e)) continue;
                // Mark all entries in this group as consumed.
                for (const other of entries) {
                    if (other.op === DiffOp.Added && (other.path === root || other.path.startsWith(root + "/"))) {
                        consumedByGroup.add(other);
                    }
                }
                flipped.push({
                    op: DiffOp.Removed,
                    path: root,
                    pathId: 0n,
                });
                continue;
            }
        }
        flipped.push({
            ...e,
            op:
                e.op === DiffOp.Added
                    ? DiffOp.Removed
                    : e.op === DiffOp.Removed
                    ? DiffOp.Added
                    : DiffOp.Modified,
            leftValue: e.rightValue,
            rightValue: e.leftValue,
            leftBytes: e.rightBytes,
            rightBytes: e.leftBytes,
        });
    }

    // Replay removals last (and from highest index first) so array indices
    // stay stable when undoing additions.
    flipped.sort((a, b) => {
        if (a.op === b.op) {
            if (a.op === DiffOp.Removed) {
                // Descending path order: deeper / higher-index first.
                return b.path.localeCompare(a.path, "en", { numeric: true });
            }
            return 0;
        }
        if (a.op === DiffOp.Removed) return 1;
        if (b.op === DiffOp.Removed) return -1;
        return 0;
    });

    return applyPatch(target, flipped, options);
}

/**
 * Convert a diff to a standard RFC 6902 JSON Patch document. The result is
 * interoperable with `fast-json-patch`, `jsondiffpatch`, and the IETF spec.
 *
 * @example
 * ```ts
 * const result = await diff(a, b);
 * const ops = toJsonPatch(result);
 * // [{ op: 'replace', path: '/users/0/name', value: 'Bob' }, ...]
 * ```
 */
export function toJsonPatch(diff: DiffResult | DiffEntry[]): JsonPatchOp[] {
    const entries = Array.isArray(diff) ? diff : diff.entries;
    const ops: JsonPatchOp[] = [];
    for (const e of entries) {
        switch (e.op) {
            case DiffOp.Added:
                ops.push({ op: "add", path: e.path, value: (e.rightValue ?? null) as JsonValue });
                break;
            case DiffOp.Removed:
                ops.push({ op: "remove", path: e.path });
                break;
            case DiffOp.Modified:
                ops.push({ op: "replace", path: e.path, value: (e.rightValue ?? null) as JsonValue });
                break;
        }
    }
    return ops;
}
