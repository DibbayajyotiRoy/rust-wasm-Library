// UX scenario: Optimistic UI updates.
// User clicks "Like" → app updates immediately. Server might reject the
// request (rate limit, auth, validation). The client must revert cleanly.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, applyPatch, revertPatch } from "../../dist/index.js";

test("optimistic-ui: apply locally, server accepts, no rollback needed", async () => {
    const initial = { post: { id: 1, likes: 5, likedByMe: false } };
    const optimistic = { post: { id: 1, likes: 6, likedByMe: true } };

    const patch = await diff(JSON.stringify(initial), JSON.stringify(optimistic));
    const uiState = applyPatch(initial, patch);

    assert.deepEqual(uiState, optimistic, "UI reflects the optimistic change");
    // Server accepts → we keep uiState, no further work.
});

test("optimistic-ui: server rejects, revert cleanly back to initial", async () => {
    const initial = { post: { id: 1, likes: 5, likedByMe: false } };
    const optimistic = { post: { id: 1, likes: 6, likedByMe: true } };

    const patch = await diff(JSON.stringify(initial), JSON.stringify(optimistic));
    const uiState = applyPatch(initial, patch);

    // Server returned 429 — undo the optimistic update:
    const reverted = revertPatch(uiState, patch);
    assert.deepEqual(reverted, initial, "state is bit-for-bit restored after revert");
});

test("optimistic-ui: round-trip of complex nested change", async () => {
    const initial = {
        cart: {
            items: [{ id: "a", qty: 1 }, { id: "b", qty: 2 }],
            total: 30,
        },
    };
    const optimistic = {
        cart: {
            items: [{ id: "a", qty: 2 }, { id: "b", qty: 2 }, { id: "c", qty: 1 }],
            total: 50,
        },
    };

    const patch = await diff(JSON.stringify(initial), JSON.stringify(optimistic));
    const applied = applyPatch(initial, patch);
    assert.deepEqual(applied, optimistic, "applyPatch produces the optimistic state");

    const reverted = revertPatch(applied, patch);
    assert.deepEqual(reverted, initial,
        "revertPatch produces the EXACT original — no empty {} shells from added array elements");
});
