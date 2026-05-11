/**
 * Path index: maps WASM-emitted u64 path hashes back to real JSON Pointers
 * and resolves leaf values from the original input bytes.
 *
 * The Rust core emits opaque path hashes for speed. To preserve speed while
 * giving developers usable output, we replicate the exact same FNV-1a-style
 * rolling hash in JS, walk the input bytes once, and build a `pathId → info`
 * lookup. The walk is O(n) and runs alongside the WASM diff.
 */

const FNV_PRIME = 0x100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

/** Fold a UTF-8 segment (object key) into the parent hash. */
export function foldSegment(parent: bigint, bytes: Uint8Array): bigint {
    let h = parent;
    for (let i = 0; i < bytes.length; i++) {
        h = (h * FNV_PRIME) & U64_MASK;
        h ^= BigInt(bytes[i]);
    }
    return h;
}

/** Fold an array index into the parent hash. */
export function foldIndex(parent: bigint, index: number): bigint {
    let h = (parent * FNV_PRIME) & U64_MASK;
    h ^= BigInt(index);
    return h;
}

/** Reverse `pathIdLow + pathIdHigh << 32` into a BigInt. */
export function pathIdFromU32Pair(low: number, high: number): bigint {
    return (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
}

export interface LeafInfo {
    /** RFC 6901 JSON Pointer string, e.g. `/users/0/name`. */
    pointer: string;
    /** Original 64-bit path hash from the engine. */
    pathId: bigint;
    /** Byte offset of the value content in the source input. */
    valueOffset: number;
    /** Byte length of the value content. */
    valueLen: number;
    /** `true` if this leaf was a JSON string (value bytes exclude quotes). */
    isString: boolean;
}

export interface PathIndex {
    byPathId: Map<bigint, LeafInfo>;
}

/** Escape per RFC 6901: `~` → `~0`, `/` → `~1`. */
function escapePointer(seg: string): string {
    return seg.replace(/~/g, "~0").replace(/\//g, "~1");
}

function decodeKey(raw: Uint8Array): string {
    const str = new TextDecoder().decode(raw);
    if (!str.includes("\\")) return str;
    try {
        return JSON.parse('"' + str + '"');
    } catch {
        return str;
    }
}

/**
 * Walk JSON bytes and build a path index that mirrors the Rust parser's hashes.
 * Best-effort: on malformed JSON, returns the partial map collected so far.
 */
export function buildPathIndex(bytes: Uint8Array): PathIndex {
    const byPathId = new Map<bigint, LeafInfo>();
    const n = bytes.length;
    let i = 0;

    const skipWs = (): void => {
        while (i < n) {
            const b = bytes[i];
            if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) i++;
            else break;
        }
    };

    const recordLeaf = (
        pathId: bigint,
        pointer: string,
        valueOffset: number,
        valueLen: number,
        isString: boolean
    ): void => {
        if (!byPathId.has(pathId)) {
            byPathId.set(pathId, { pointer, pathId, valueOffset, valueLen, isString });
        }
    };

    const readStringContent = (): { start: number; end: number } => {
        // bytes[i] === '"'
        const start = i + 1;
        i++;
        while (i < n) {
            const b = bytes[i];
            if (b === 0x5c) {
                i += 2;
                continue;
            }
            if (b === 0x22) {
                const end = i;
                i++;
                return { start, end };
            }
            i++;
        }
        throw new Error("unterminated string");
    };

    const readPrimitive = (): { start: number; end: number } => {
        const start = i;
        while (i < n) {
            const b = bytes[i];
            if (
                b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d ||
                b === 0x2c || b === 0x7d || b === 0x5d
            ) break;
            i++;
        }
        return { start, end: i };
    };

    const parseValue = (slotId: bigint, slotPointer: string): void => {
        skipWs();
        if (i >= n) return;
        const b = bytes[i];
        if (b === 0x7b) {
            i++;
            parseObject(slotId, slotPointer);
        } else if (b === 0x5b) {
            i++;
            parseArray(slotId, slotPointer);
        } else if (b === 0x22) {
            const { start, end } = readStringContent();
            recordLeaf(slotId, slotPointer, start, end - start, true);
        } else {
            const { start, end } = readPrimitive();
            recordLeaf(slotId, slotPointer, start, end - start, false);
        }
    };

    const parseObject = (parentId: bigint, parentPointer: string): void => {
        skipWs();
        if (i < n && bytes[i] === 0x7d) {
            i++;
            return;
        }
        while (i < n) {
            skipWs();
            if (bytes[i] !== 0x22) throw new Error("expected object key");
            const keyStart = i + 1;
            i++;
            while (i < n) {
                const b = bytes[i];
                if (b === 0x5c) {
                    i += 2;
                    continue;
                }
                if (b === 0x22) break;
                i++;
            }
            const keyEnd = i;
            i++;
            const keyBytes = bytes.subarray(keyStart, keyEnd);
            const slotId = foldSegment(parentId, keyBytes);
            const slotPointer = parentPointer + "/" + escapePointer(decodeKey(keyBytes));
            skipWs();
            if (bytes[i] !== 0x3a) throw new Error("expected ':'");
            i++;
            parseValue(slotId, slotPointer);
            skipWs();
            if (i < n && bytes[i] === 0x2c) {
                i++;
                continue;
            }
            if (i < n && bytes[i] === 0x7d) {
                i++;
                return;
            }
            throw new Error("expected ',' or '}'");
        }
    };

    const parseArray = (parentId: bigint, parentPointer: string): void => {
        skipWs();
        if (i < n && bytes[i] === 0x5d) {
            i++;
            return;
        }
        let index = 0;
        while (i < n) {
            const slotId = foldIndex(parentId, index);
            const slotPointer = parentPointer + "/" + index;
            parseValue(slotId, slotPointer);
            skipWs();
            if (i < n && bytes[i] === 0x2c) {
                i++;
                index++;
                continue;
            }
            if (i < n && bytes[i] === 0x5d) {
                i++;
                return;
            }
            throw new Error("expected ',' or ']'");
        }
    };

    try {
        parseValue(0n, "");
    } catch {
        // best-effort: partial index is still useful
    }

    return { byPathId };
}

/**
 * Decode a leaf's bytes to a JS value using the index info.
 * - Strings: decoded with JSON escape rules.
 * - Primitives (number / boolean / null): JSON.parse.
 * - On failure: returns the raw decoded text.
 */
export function decodeLeafValue(
    inputBytes: Uint8Array,
    info: LeafInfo
): string | number | boolean | null {
    const slice = inputBytes.subarray(info.valueOffset, info.valueOffset + info.valueLen);
    const text = new TextDecoder().decode(slice);
    if (info.isString) {
        if (!text.includes("\\")) return text;
        try {
            return JSON.parse('"' + text + '"');
        } catch {
            return text;
        }
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
