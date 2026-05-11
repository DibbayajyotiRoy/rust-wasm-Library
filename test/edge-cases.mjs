// Edge cases: nulls, booleans, deep nesting, unicode, escapes, whitespace.
import { diff, applyPatch } from "../dist/index.js";

let pass = 0, fail = 0;
function check(name, l, r, expected) {
    const r2 = diff(l, r).then(result => {
        const ok = expected(result);
        if (ok) { pass++; console.log("PASS  " + name); }
        else { fail++; console.log("FAIL  " + name + "  → " + JSON.stringify(result.entries.map(e => ({ op: e.op, path: e.path, left: e.leftValue, right: e.rightValue })))); }
        return null;
    });
    return r2;
}

async function rt(name, l, r) {
    const result = await diff(JSON.stringify(l), JSON.stringify(r));
    const reconstructed = applyPatch(l, result);
    const ok = JSON.stringify(reconstructed) === JSON.stringify(r);
    if (ok) { pass++; console.log("PASS  RT " + name); }
    else { fail++; console.log("FAIL  RT " + name + "  → got " + JSON.stringify(reconstructed) + " want " + JSON.stringify(r)); }
}

await check("null change", '{"a":null}', '{"a":1}',
    r => r.entries.length === 1 && r.entries[0].path === "/a" && r.entries[0].leftValue === null && r.entries[0].rightValue === 1);

await check("boolean change", '{"a":true}', '{"a":false}',
    r => r.entries.length === 1 && r.entries[0].path === "/a" && r.entries[0].leftValue === true && r.entries[0].rightValue === false);

await check("number formats", '{"a":1.5e10}', '{"a":-2.7e-3}',
    r => r.entries.length === 1 && r.entries[0].path === "/a" && r.entries[0].leftValue === 1.5e10 && r.entries[0].rightValue === -0.0027);

await check("whitespace tolerant", '{\n  "a": 1\n}', '{\n  "a": 2\n}',
    r => r.entries.length === 1 && r.entries[0].path === "/a");

await check("deep nesting 5 levels", '{"a":{"b":{"c":{"d":{"e":1}}}}}', '{"a":{"b":{"c":{"d":{"e":2}}}}}',
    r => r.entries.length === 1 && r.entries[0].path === "/a/b/c/d/e" && r.entries[0].rightValue === 2);

await check("unicode value", '{"a":"héllo"}', '{"a":"wörld"}',
    r => r.entries.length === 1 && r.entries[0].path === "/a" && r.entries[0].rightValue === "wörld");

await check("escaped string", '{"a":"line\\nbreak"}', '{"a":"line\\tbreak"}',
    r => r.entries.length === 1 && r.entries[0].path === "/a");

await check("nested array of objects modified", '[{"x":1,"y":2},{"x":3,"y":4}]', '[{"x":1,"y":5},{"x":3,"y":6}]',
    r => r.entries.length === 2 && r.entries.every(e => e.path.endsWith("/y")));

await check("identical inputs → 0 entries", '{"a":1}', '{"a":1}', r => r.entries.length === 0);

await check("key removed", '{"a":1,"b":2}', '{"a":1}',
    r => r.entries.length === 1 && r.entries[0].op === 1 /*Removed*/ && r.entries[0].path === "/b");

await rt("primitives in object", { a: 1, b: "x", c: null, d: true }, { a: 2, b: "y", c: false, d: null });
await rt("nested deep", { a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
await rt("array primitive append", { tags: ["a", "b"] }, { tags: ["a", "b", "c"] });
await rt("array primitive remove tail", { tags: ["a", "b", "c"] }, { tags: ["a", "b"] });

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
