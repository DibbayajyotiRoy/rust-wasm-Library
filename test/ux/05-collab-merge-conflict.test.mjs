// UX scenario: Two collaborators edit the same document.
// Alice opens the doc, Bob opens the doc. Both edit, both save. The server
// (or sync engine) must merge their changes. Where they touched different
// fields, both edits land. Where they collide, the system needs a policy.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { merge3, detectConflicts, MergeConflictError } from "../../dist/state.js";
import { diff } from "../../dist/index.js";

const base = {
    title: "Draft",
    body: "Hello",
    tags: ["draft"],
    author: { name: "Original Author", contact: "" },
};

test("collab-merge: non-overlapping edits both apply automatically", async () => {
    const alice = { ...base, title: "Final" };                       // touches /title
    const bob   = { ...base, body: "Hello world", tags: ["draft", "review"] }; // touches /body, /tags/1

    const result = await merge3(base, alice, bob);

    assert.equal(result.conflicts.length, 0, "no overlapping paths");
    assert.equal(result.value.title, "Final");
    assert.equal(result.value.body, "Hello world");
    assert.deepEqual(result.value.tags, ["draft", "review"]);
});

test("collab-merge: 'throw' surfaces conflicts as a typed error", async () => {
    const alice = { ...base, title: "Alice's Title" };
    const bob   = { ...base, title: "Bob's Title" };

    let caught = null;
    try {
        await merge3(base, alice, bob, { strategy: "throw" });
    } catch (err) {
        caught = err;
    }

    assert.ok(caught instanceof MergeConflictError, "got a typed error");
    assert.equal(caught.conflicts.length, 1);
    assert.equal(caught.conflicts[0].path, "/title");
    assert.equal(caught.conflicts[0].a.value, "Alice's Title");
    assert.equal(caught.conflicts[0].b.value, "Bob's Title");
});

test("collab-merge: 'prefer-b' resolves last-write-wins style", async () => {
    const alice = { ...base, title: "A" };
    const bob   = { ...base, title: "B" };

    const result = await merge3(base, alice, bob, { strategy: "prefer-b" });
    assert.equal(result.value.title, "B", "Bob's edit wins");
    assert.equal(result.conflicts.length, 1, "conflict was still reported");
});

test("collab-merge: same outcome on both sides isn't a real conflict", async () => {
    const alice = { ...base, title: "Same" };
    const bob   = { ...base, title: "Same" };

    // Even with 'throw' strategy, identical edits should pass through.
    const result = await merge3(base, alice, bob, { strategy: "throw" });
    assert.equal(result.value.title, "Same");
});

test("collab-merge: detectConflicts() before attempting merge3", async () => {
    // Useful pattern: surface conflicts in the UI before the merge runs.
    const alice = { ...base, title: "A", tags: ["draft", "alice"] };
    const bob   = { ...base, title: "B", tags: ["draft", "bob"] };

    const patchA = await diff(JSON.stringify(base), JSON.stringify(alice));
    const patchB = await diff(JSON.stringify(base), JSON.stringify(bob));
    const conflicts = detectConflicts(patchA, patchB);

    const paths = conflicts.map((c) => c.path).sort();
    assert.deepEqual(paths, ["/tags/1", "/title"]);
});
