// Round-trip: diff → applyPatch reconstructs the right document.
// Useful for: state sync, undo/redo, optimistic updates.
import { diff, applyPatch, revertPatch } from "diffcore";

const before = { count: 1, tags: ["a", "b"], meta: { active: true } };
const after = { count: 2, tags: ["a", "b", "c"], meta: { active: false } };

const result = await diff(JSON.stringify(before), JSON.stringify(after));

const reconstructed = applyPatch(before, result);
console.log("applyPatch matches:", JSON.stringify(reconstructed) === JSON.stringify(after));

const undone = revertPatch(after, result);
console.log("revertPatch matches:", JSON.stringify(undone) === JSON.stringify(before));
