// UX scenario: Audit log.
// Every state change is recorded as a diff. To recover the state at time T,
// replay every patch from t=0. Patches must be storable (JSON-safe), tiny,
// and the replay must produce the EXACT original states.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, applyPatch } from "../../dist/index.js";

test("audit-log: replay all patches reconstructs every checkpoint", async () => {
    // Five timeline checkpoints of an evolving document:
    const checkpoints = [
        { title: "Draft", views: 0, tags: [] },
        { title: "Draft", views: 1, tags: [] },
        { title: "Published", views: 1, tags: ["new"] },
        { title: "Published", views: 25, tags: ["new"] },
        { title: "Published", views: 25, tags: ["new", "featured"] },
    ];

    // Record patches between consecutive checkpoints:
    const patches = [];
    for (let i = 1; i < checkpoints.length; i++) {
        patches.push(await diff(
            JSON.stringify(checkpoints[i - 1]),
            JSON.stringify(checkpoints[i])
        ));
    }

    // Replay from checkpoint 0:
    let state = checkpoints[0];
    for (let i = 0; i < patches.length; i++) {
        state = applyPatch(state, patches[i]);
        assert.deepEqual(state, checkpoints[i + 1],
            `replay reproduces checkpoint ${i + 1}`);
    }
});

test("audit-log: patches are JSON-serializable for storage", async () => {
    const patch = await diff(
        '{"a":1,"users":[{"name":"x"}]}',
        '{"a":2,"users":[{"name":"y"}]}'
    );

    const stored = JSON.stringify(patch.toJSON());
    const loaded = JSON.parse(stored);

    // The loaded patch can be applied just like the original:
    const initial = { a: 1, users: [{ name: "x" }] };
    const replayed = applyPatch(initial, loaded.entries);
    assert.deepEqual(replayed, { a: 2, users: [{ name: "y" }] });
});

test("audit-log: patches are usable across processes (no bigint leak)", async () => {
    const patch = await diff('{"a":1}', '{"a":2}');
    const serialized = patch.toJSON();
    for (const entry of serialized.entries) {
        assert.equal(typeof entry.pathId, "string",
            "pathId is a hex string, not a bigint — survives postMessage");
    }
});
