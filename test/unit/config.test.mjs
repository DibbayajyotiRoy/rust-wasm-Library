// Unit: config defaults + EDGE_CONFIG shape.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, EDGE_CONFIG, ArrayDiffMode } from "../../dist/index.js";

test("config: diff() runs with no options at all", async () => {
    const result = await diff('{"a":1}', '{"a":2}');
    assert.ok(result.entries.length > 0);
});

test("config: EDGE_CONFIG has lower memory caps than defaults", () => {
    assert.ok(EDGE_CONFIG.maxMemoryBytes < 32 * 1024 * 1024);
    assert.ok(EDGE_CONFIG.maxInputSize < 64 * 1024 * 1024);
});

test("config: EDGE_CONFIG works end-to-end", async () => {
    const result = await diff('{"a":1}', '{"a":2}', EDGE_CONFIG);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].path, "/a");
});

test("config: ArrayDiffMode enum values are stable", () => {
    assert.equal(ArrayDiffMode.Index, 0);
    assert.equal(ArrayDiffMode.HashWindow, 1);
    assert.equal(ArrayDiffMode.Full, 2);
});

test("config: ignore filter accepts an empty array (no-op)", async () => {
    const result = await diff('{"a":1}', '{"a":2}', { ignore: [] });
    assert.equal(result.entries.length, 1);
});

test("config: scope on a non-existent path returns empty entries", async () => {
    const result = await diff('{"a":1}', '{"a":2}', { scope: "/nonexistent" });
    assert.equal(result.entries.length, 0);
});

test("config: resolvePaths:false produces hash-format paths", async () => {
    const result = await diff('{"a":1}', '{"a":2}', { resolvePaths: false });
    assert.match(result.entries[0].path, /^#hash:/, "hash format when path resolution disabled");
});
