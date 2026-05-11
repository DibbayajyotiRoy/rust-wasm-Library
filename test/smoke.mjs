// Smoke test — does the built dist actually produce real paths and values?
import { diff, applyPatch, revertPatch, toJsonPatch, formatDiff, DiffOp } from "../dist/index.js";

const before = { users: [{ id: 1, name: "Alice", role: "admin" }, { id: 2, name: "Bob" }] };
const after = { users: [{ id: 1, name: "Alice", role: "owner" }, { id: 2, name: "Bob" }, { id: 3, name: "Carol" }] };

const result = await diff(JSON.stringify(before), JSON.stringify(after));

console.log("\n=== formatDiff ===");
console.log(formatDiff(result, { color: false }));

console.log("\n=== entries ===");
for (const e of result.entries) {
    console.log(`  ${DiffOp[e.op].padEnd(8)} path=${e.path}  left=${JSON.stringify(e.leftValue)}  right=${JSON.stringify(e.rightValue)}`);
}

console.log("\n=== toJsonPatch ===");
console.log(JSON.stringify(toJsonPatch(result), null, 2));

console.log("\n=== applyPatch roundtrip ===");
const reconstructed = applyPatch(before, result);
const ok = JSON.stringify(reconstructed) === JSON.stringify(after);
console.log("  reconstructed == after:", ok);
if (!ok) {
    console.log("  reconstructed:", JSON.stringify(reconstructed));
    console.log("  expected     :", JSON.stringify(after));
}

console.log("\n=== revertPatch roundtrip ===");
const undone = revertPatch(after, result);
const undoneOk = JSON.stringify(undone) === JSON.stringify(before);
console.log("  undone == before:", undoneOk);
if (!undoneOk) {
    console.log("  undone  :", JSON.stringify(undone));
    console.log("  expected:", JSON.stringify(before));
}

process.exit(ok && undoneOk ? 0 : 1);
