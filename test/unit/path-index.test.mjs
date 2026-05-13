// Unit: buildPathIndex() and the FNV-1a path hash helpers.
// This module is what makes "real JSON Pointer paths" possible — if it
// breaks, every diff result regresses to opaque hashes.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildPathIndex, foldSegment, foldIndex } from "../../dist/index.js";

const enc = (s) => new TextEncoder().encode(s);

test("path-index: top-level scalar (no path entries expected for the root)", () => {
    // A standalone scalar JSON has no leaves at "/x" — the whole thing is root.
    const index = buildPathIndex(enc("42"));
    // We still get a single leaf at pathId=0 (root).
    const entry = index.byPathId.get(0n);
    assert.ok(entry, "root leaf recorded for a bare primitive");
    assert.equal(entry.pointer, "");
});

test("path-index: simple object — one entry per leaf, correct pointer", () => {
    const index = buildPathIndex(enc('{"a":1,"b":"x"}'));
    const aId = foldSegment(0n, enc("a"));
    const bId = foldSegment(0n, enc("b"));

    assert.equal(index.byPathId.get(aId)?.pointer, "/a");
    assert.equal(index.byPathId.get(bId)?.pointer, "/b");
});

test("path-index: nested object", () => {
    const index = buildPathIndex(enc('{"outer":{"inner":42}}'));
    const innerId = foldSegment(foldSegment(0n, enc("outer")), enc("inner"));
    assert.equal(index.byPathId.get(innerId)?.pointer, "/outer/inner");
});

test("path-index: array elements get index-suffixed pointers", () => {
    const index = buildPathIndex(enc('[10,20,30]'));
    for (let i = 0; i < 3; i++) {
        const id = foldIndex(0n, i);
        assert.equal(index.byPathId.get(id)?.pointer, `/${i}`);
    }
});

test("path-index: array of objects", () => {
    const index = buildPathIndex(enc('[{"n":"A"},{"n":"B"}]'));
    const id0 = foldSegment(foldIndex(0n, 0), enc("n"));
    const id1 = foldSegment(foldIndex(0n, 1), enc("n"));
    assert.equal(index.byPathId.get(id0)?.pointer, "/0/n");
    assert.equal(index.byPathId.get(id1)?.pointer, "/1/n");
});

test("path-index: keys with `/` and `~` escape per RFC 6901", () => {
    const index = buildPathIndex(enc('{"a/b":1,"c~d":2}'));
    const aId = foldSegment(0n, enc("a/b"));
    const cId = foldSegment(0n, enc("c~d"));
    assert.equal(index.byPathId.get(aId)?.pointer, "/a~1b", "/ → ~1");
    assert.equal(index.byPathId.get(cId)?.pointer, "/c~0d", "~ → ~0");
});

test("path-index: whitespace and newlines don't break the walker", () => {
    const index = buildPathIndex(enc(`{
        "a": 1,
        "b": 2
    }`));
    const aId = foldSegment(0n, enc("a"));
    assert.equal(index.byPathId.get(aId)?.pointer, "/a");
});

test("path-index: malformed JSON returns partial-best-effort, doesn't throw", () => {
    // Partial map is acceptable; throwing is not.
    let didThrow = false;
    try {
        buildPathIndex(enc('{"a":1,"b":}'));
    } catch {
        didThrow = true;
    }
    assert.equal(didThrow, false, "should be lenient");
});

test("path-index: hashes match the Rust engine for ASCII keys", () => {
    // Smoke-test the hash function constants vs Rust's path::fold_segment_hash.
    // Same inputs must produce same u64 output.
    const expected = (() => {
        const FNV = 0x100000001b3n;
        const MASK = 0xffffffffffffffffn;
        let h = 0n;
        for (const b of enc("name")) {
            h = (h * FNV) & MASK;
            h ^= BigInt(b);
        }
        return h;
    })();
    assert.equal(foldSegment(0n, enc("name")), expected);
});
