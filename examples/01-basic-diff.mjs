// Basic diff — the simplest possible usage.
// Run: node examples/01-basic-diff.mjs
import { diff, DiffOp } from "diffcore";

const before = JSON.stringify({
    users: [
        { id: 1, name: "Alice", role: "admin" },
        { id: 2, name: "Bob", role: "user" },
    ],
});

const after = JSON.stringify({
    users: [
        { id: 1, name: "Alice", role: "owner" },
        { id: 2, name: "Bob", role: "user" },
        { id: 3, name: "Carol", role: "user" },
    ],
});

const result = await diff(before, after);

for (const e of result.entries) {
    console.log(`${DiffOp[e.op].padEnd(8)} ${e.path}  ${JSON.stringify(e.leftValue)} → ${JSON.stringify(e.rightValue)}`);
}
