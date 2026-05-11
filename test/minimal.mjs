// Bisect: does the simplest possible diff work?
import { diff } from "../dist/index.js";

const cases = [
    { left: '{"a":1}', right: '{"a":2}', name: "single primitive change" },
    { left: '{"name":"Alice"}', right: '{"name":"Bob"}', name: "single string change" },
    { left: '[1,2,3]', right: '[1,2,4]', name: "array tail change" },
    { left: '{"a":1,"b":2}', right: '{"a":1,"b":3}', name: "second key change" },
];

for (const c of cases) {
    console.log("\n--- " + c.name + " ---");
    console.log("  left :", c.left);
    console.log("  right:", c.right);
    const r = await diff(c.left, c.right);
    for (const e of r.entries) {
        console.log(`  entry: op=${e.op} path=${e.path} left=${JSON.stringify(e.leftValue)} right=${JSON.stringify(e.rightValue)} pathId=${e.pathId.toString(16)}`);
    }
}
