// UX scenario: Diffs travel between processes.
// browser tab ↔ web worker (postMessage), client ↔ server (HTTP), or
// service ↔ service (queue). The wire payload must survive standard JSON
// transport without TypeErrors on bigint or Uint8Array.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, applyPatch } from "../../dist/index.js";

// Simulate any JSON-only transport (postMessage, HTTP body, message queue).
function sendOverWire(payload) {
    return JSON.parse(JSON.stringify(payload));
}

test("wire: toJSON survives JSON.stringify → JSON.parse", async () => {
    const result = await diff(
        '{"a":1,"b":2,"users":[{"id":1}]}',
        '{"a":1,"b":99,"users":[{"id":1},{"id":2}]}'
    );

    // The raw DiffResult contains bigint pathIds and Uint8Array bytes.
    // Plain JSON.stringify on result would throw — but result.toJSON() is safe:
    const wirePayload = sendOverWire(result.toJSON());

    assert.equal(wirePayload.version.major, result.version.major);
    assert.equal(wirePayload.entries.length, result.entries.length);
    // pathId is a hex string on the wire:
    assert.equal(typeof wirePayload.entries[0].pathId, "string");
});

test("wire: applyPatch accepts the deserialized entries directly", async () => {
    const initial = { a: 1, b: 2, items: ["x"] };
    const next    = { a: 1, b: 9, items: ["x", "y"] };

    const result = await diff(JSON.stringify(initial), JSON.stringify(next));
    const wire = sendOverWire(result.toJSON());

    // The receiver doesn't reconstruct a DiffResult — it just feeds
    // wire.entries to applyPatch. This is the realistic remote-apply flow.
    const reconstructed = applyPatch(initial, wire.entries);
    assert.deepEqual(reconstructed, next);
});

test("wire: large payloads round-trip without precision loss", async () => {
    const before = { numbers: [1, 2, 3, 4, 5] };
    const after  = { numbers: [1, 2, 3, 4, 6, 1.7976931348623157e+100] };

    const result = await diff(JSON.stringify(before), JSON.stringify(after));
    const wire = sendOverWire(result.toJSON());
    const reconstructed = applyPatch(before, wire.entries);

    assert.deepEqual(reconstructed, after, "extreme numeric values survive the wire");
});

test("wire: ignored entries don't leak into the wire payload", async () => {
    const result = await diff(
        '{"data":{"x":1},"_meta":{"id":"a"}}',
        '{"data":{"x":2},"_meta":{"id":"b"}}',
        { ignore: ["/_meta"] }
    );
    const wire = sendOverWire(result.toJSON());
    assert.equal(wire.entries.length, 1, "/_meta entries filtered before serialization");
    assert.equal(wire.entries[0].path, "/data/x");
});
