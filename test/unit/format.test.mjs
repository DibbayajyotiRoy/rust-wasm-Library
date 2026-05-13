// Unit: formatDiff() output shape and behavior.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, formatDiff } from "../../dist/index.js";

test("formatDiff: empty diff renders the no-changes hint", async () => {
    const result = await diff('{"a":1}', '{"a":1}');
    const out = formatDiff(result, { color: false });
    assert.match(out, /no changes/i);
});

test("formatDiff: Modified entry uses ~ marker and arrow", async () => {
    const result = await diff('{"a":1}', '{"a":2}');
    const out = formatDiff(result, { color: false });
    assert.match(out, /~\s+\/a/);
    assert.match(out, /1.*→.*2/);
});

test("formatDiff: Added entry uses + marker", async () => {
    const result = await diff('{"a":1}', '{"a":1,"b":2}');
    const out = formatDiff(result, { color: false });
    assert.match(out, /\+\s+\/b/);
});

test("formatDiff: Removed entry uses - marker", async () => {
    const result = await diff('{"a":1,"b":2}', '{"a":1}');
    const out = formatDiff(result, { color: false });
    assert.match(out, /-\s+\/b/);
});

test("formatDiff: color:true emits ANSI escape sequences", async () => {
    const result = await diff('{"a":1}', '{"a":2}');
    const out = formatDiff(result, { color: true });
    // Match an ANSI escape — \x1b[31m / \x1b[32m / etc.
    assert.match(out, /\x1b\[\d+m/);
});

test("formatDiff: color:false produces plain text only", async () => {
    const result = await diff('{"a":1}', '{"a":2}');
    const out = formatDiff(result, { color: false });
    assert.doesNotMatch(out, /\x1b\[/);
});

test("formatDiff: maxValueLength truncates long values with ellipsis", async () => {
    const longString = "x".repeat(200);
    const result = await diff(
        '{"text":""}',
        JSON.stringify({ text: longString })
    );
    const out = formatDiff(result, { color: false, maxValueLength: 20 });
    assert.match(out, /…/, "trailing ellipsis present");
    // The full 200-char string should NOT be in there:
    assert.equal(out.includes("x".repeat(100)), false);
});

test("formatDiff: accepts either DiffResult or DiffEntry[]", async () => {
    const result = await diff('{"a":1}', '{"a":2}');
    const fromResult = formatDiff(result, { color: false });
    const fromArray  = formatDiff(result.entries, { color: false });
    assert.equal(fromResult, fromArray);
});
