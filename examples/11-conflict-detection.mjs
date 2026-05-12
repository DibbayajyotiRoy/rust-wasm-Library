// detectConflicts — find paths edited by two patches.
// Useful for collaborative editing, optimistic-update reconciliation,
// and "two people changed the same thing" warnings.
import { diff } from "diffcore";
import { detectConflicts } from "diffcore/state";

const base    = '{"title":"Draft","author":"Alice","views":0}';
const editorA = '{"title":"Published","author":"Alice","views":5}';
const editorB = '{"title":"Final","author":"Alice","views":3}';

const patchA = await diff(base, editorA);
const patchB = await diff(base, editorB);

for (const c of detectConflicts(patchA, patchB)) {
    console.log(`${c.path}: A wrote ${JSON.stringify(c.a.value)}, B wrote ${JSON.stringify(c.b.value)}` +
                (c.sameOutcome ? " (same outcome)" : ""));
}
//   /title: A wrote "Published", B wrote "Final"
//   /views: A wrote 5, B wrote 3
