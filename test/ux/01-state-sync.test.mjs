// UX scenario: Client/server state sync.
// A web app keeps a local copy of server state. When the user edits, the
// client computes a diff, sends ONLY the diff over the wire (much smaller
// than the full state), and the server applies it. Round-trip must be exact.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, applyPatch, toJsonPatch } from "../../dist/index.js";

test("state-sync: client diffs locally, server applies, states match", async () => {
    // Server has this state:
    const serverState = {
        document: {
            title: "Untitled",
            body: "",
            tags: [],
            collaborators: [{ name: "Alice", role: "owner" }],
        },
        meta: { version: 1 },
    };

    // Client makes some edits:
    const clientState = {
        document: {
            title: "My Document",
            body: "Hello world",
            tags: ["draft"],
            collaborators: [
                { name: "Alice", role: "owner" },
                { name: "Bob", role: "editor" },
            ],
        },
        meta: { version: 2 },
    };

    // Client: compute diff
    const patch = await diff(JSON.stringify(serverState), JSON.stringify(clientState));

    // Each leaf change is a separate entry:
    //   title, body, +tags/0, +collaborators/1/name, +collaborators/1/role, version
    assert.equal(patch.entries.length, 6, "six leaf changes");

    // Client serializes the diff to send over the wire. Critically: toJSON()
    // produces JSON.stringify-safe output even though entries contain bigint
    // pathIds internally. No "TypeError: Do not know how to serialize a BigInt".
    const wirePayload = JSON.stringify(patch.toJSON());
    assert.ok(typeof wirePayload === "string", "toJSON serializes without throwing");

    // Server receives the wire payload, applies it to its local copy:
    const received = JSON.parse(wirePayload);
    const updated = applyPatch(serverState, received.entries);

    assert.deepEqual(updated, clientState, "server state matches client state exactly");
});

test("state-sync: RFC 6902 JSON Patch interop with hand-rolled server", async () => {
    // The server doesn't run diffcore — it has fast-json-patch or jsondiffpatch
    // or even hand-rolled JSON Patch handling. diffcore's toJsonPatch() must
    // produce ops that any RFC 6902-compliant consumer can apply.

    const oldState = { user: { name: "Alice", age: 30 }, posts: [] };
    const newState = { user: { name: "Alice", age: 31 }, posts: [{ id: 1 }] };

    const ops = toJsonPatch(await diff(JSON.stringify(oldState), JSON.stringify(newState)));

    // Validate RFC 6902 shape (no extra fields, recognized op types):
    for (const op of ops) {
        assert.ok(
            ["add", "remove", "replace", "move", "copy", "test"].includes(op.op),
            `op type "${op.op}" is in RFC 6902`
        );
        assert.ok(op.path.startsWith("/"), "path is a JSON Pointer");
    }

    // The ops contain the actual changes:
    const ageOp = ops.find((o) => o.path === "/user/age");
    assert.equal(ageOp?.op, "replace");
    assert.equal(ageOp?.value, 31);

    // The new post adds /posts/0/id (a leaf inside a freshly inserted element):
    const postOp = ops.find((o) => o.path === "/posts/0/id");
    assert.ok(postOp, "post addition recorded as leaf");
    assert.equal(postOp?.op, "add");
    assert.equal(postOp?.value, 1);
});

test("state-sync: optional `ignore` skips noisy meta fields", async () => {
    // Real-world: every server response has fields the client doesn't care
    // about — timestamps, ETags, request IDs. Drop them at diff time.
    const before = { data: { count: 5 }, _meta: { fetchedAt: 1, etag: "a" } };
    const after  = { data: { count: 5 }, _meta: { fetchedAt: 9, etag: "b" } };

    const patch = await diff(JSON.stringify(before), JSON.stringify(after), {
        ignore: ["/_meta"],
    });
    assert.equal(patch.entries.length, 0, "no meaningful changes after ignoring /_meta");
});
