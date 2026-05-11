import { diff } from "../dist/index.js";

const cases = [
    { left: '[{"a":1}]', right: '[{"a":2}]', name: "1-elem array of obj — value change" },
    { left: '[{"a":1},{"b":2}]', right: '[{"a":1},{"b":3}]', name: "2-elem array — last value change" },
    { left: '[{"a":1}]', right: '[{"a":1},{"b":2}]', name: "array grows by 1 (added obj)" },
    { left: '{"users":[{"name":"A"}]}', right: '{"users":[{"name":"A"},{"name":"B"}]}', name: "users-array grows" },
    { left: '{"a":[1,2]}', right: '{"a":[1,2,3]}', name: "array of primitives grows" },
];

for (const c of cases) {
    console.log("\n--- " + c.name + " ---");
    console.log("  left :", c.left);
    console.log("  right:", c.right);
    const r = await diff(c.left, c.right);
    for (const e of r.entries) {
        console.log(`    op=${e.op} path=${e.path}  left=${JSON.stringify(e.leftValue)} right=${JSON.stringify(e.rightValue)}`);
    }
    if (r.entries.length === 0) console.log("    (no entries)");
}
