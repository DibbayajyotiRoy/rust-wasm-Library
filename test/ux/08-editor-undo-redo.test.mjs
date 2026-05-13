// UX scenario: A Notion/Slate-style editor with undo/redo.
// User makes 10 edits, undoes back to start, redoes forward.
// History storage is patch-based — must stay bounded even after lots of edits.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createHistory } from "../../dist/state.js";

test("editor: undo all the way back, then redo all the way forward", async () => {
    const initial = { blocks: [{ type: "p", text: "" }] };
    const history = createHistory(initial);

    // Simulate 10 keystrokes / block-inserts:
    const snapshots = [];
    let state = initial;
    for (let i = 1; i <= 10; i++) {
        state = {
            blocks: [
                ...state.blocks.slice(0, -1),
                { type: "p", text: "x".repeat(i) },
            ],
        };
        snapshots.push(state);
        await history.push(state);
    }

    assert.equal(history.size(), 10, "10 patches stored");

    // Undo all 10:
    for (let i = 9; i >= 0; i--) {
        const expected = i === 0 ? initial : snapshots[i - 1];
        const result = history.undo();
        assert.deepEqual(result, expected, `undo to step ${i}`);
    }
    assert.equal(history.canUndo(), false);

    // Redo all 10 — should retrace exactly:
    for (let i = 0; i < 10; i++) {
        const result = history.redo();
        assert.deepEqual(result, snapshots[i], `redo to step ${i + 1}`);
    }
    assert.equal(history.canRedo(), false);
});

test("editor: pushing a new edit after undo clears the redo stack", async () => {
    const history = createHistory({ x: 0 });
    await history.push({ x: 1 });
    await history.push({ x: 2 });
    history.undo();             // now at { x: 1 }
    assert.equal(history.canRedo(), true);

    // User types something new — redo should be gone:
    await history.push({ x: 99 });
    assert.equal(history.canRedo(), false, "branching history drops the redo stack");
    assert.deepEqual(history.current, { x: 99 });
});

test("editor: maxSize keeps memory bounded", async () => {
    const history = createHistory({ n: 0 }, { maxSize: 5 });
    for (let i = 1; i <= 20; i++) await history.push({ n: i });
    assert.equal(history.size(), 5, "only the last 5 undo steps are retained");
});

test("editor: deduplicates a no-op push", async () => {
    const history = createHistory({ x: 1 });
    await history.push({ x: 1 });     // identical
    assert.equal(history.size(), 0, "no-op push doesn't grow history");
});
