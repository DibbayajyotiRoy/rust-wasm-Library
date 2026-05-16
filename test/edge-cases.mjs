// Edge cases: nulls, booleans, deep nesting, unicode, escapes, whitespace.
import { diff, applyPatch, createEngine, Status } from "../dist/index.js";

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

// Regression: an escaped quote inside a string literal must not be read as
// the string terminator — otherwise every path hash after it desyncs.
await check("escaped quote in value", '{"a":"say \\"hi\\""}', '{"a":"say \\"bye\\""}',
    r => r.entries.length === 1 && r.entries[0].path === "/a" &&
         r.entries[0].rightValue === 'say "bye"');

await check("escaped quote in key", '{"a\\"b":1,"x":1}', '{"a\\"b":1,"x":2}',
    r => r.entries.length === 1 && r.entries[0].path === "/x");

await check("escaped quote in key — keyed value changes", '{"q\\"k":1}', '{"q\\"k":2}',
    r => r.entries.length === 1 && r.entries[0].path === '/q"k' && r.entries[0].rightValue === 2);

await check("trailing backslash not read as escape", '{"p":"path\\\\"}', '{"p":"diff\\\\"}',
    r => r.entries.length === 1 && r.entries[0].path === "/p");

// Regression: object key "0" and array index [48] must not collide
// (both were `parent*PRIME ^ 0x30` before the golden-ratio index mix).
await check("key \"0\" vs array index 48 — no hash collision",
    '{"g":{"0":"x"}}',
    '{"g":["a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","z"]}',
    r => r.entries.some(e => e.op === 1 && e.path === "/g/0") &&
         r.entries.some(e => e.op === 0 && e.path === "/g/48"));

await check("nested array of objects modified", '[{"x":1,"y":2},{"x":3,"y":4}]', '[{"x":1,"y":5},{"x":3,"y":6}]',
    r => r.entries.length === 2 && r.entries.every(e => e.path.endsWith("/y")));

await check("identical inputs → 0 entries", '{"a":1}', '{"a":1}', r => r.entries.length === 0);

await check("key removed", '{"a":1,"b":2}', '{"a":1}',
    r => r.entries.length === 1 && r.entries[0].op === 1 /*Removed*/ && r.entries[0].path === "/b");

// Streaming: a document fed in many small chunks must diff identically to
// the one-shot path. Per-chunk commits used to re-parse from offset 0 and
// corrupt multi-chunk streams — this guards the fix.
async function streamTest() {
    const l = JSON.stringify({ users: [{ name: "Alice", role: "admin" }], meta: { count: 2 } });
    const r = JSON.stringify({ users: [{ name: "Alice", role: "owner" }], meta: { count: 3 } });
    const split = (s, n) => {
        const b = new TextEncoder().encode(s), out = [];
        for (let i = 0; i < b.length; i += n) out.push(b.subarray(i, i + n));
        return out;
    };
    const engine = await createEngine();
    for (const c of split(l, 7)) if (engine.pushLeft(c) !== Status.Ok) throw new Error("left push");
    for (const c of split(r, 5)) if (engine.pushRight(c) !== Status.Ok) throw new Error("right push");
    const res = engine.finalize();
    const paths = res.entries.map(e => e.path).sort();
    const ok = paths.length === 2 && paths[0] === "/meta/count" && paths[1] === "/users/0/role";
    if (ok) { pass++; console.log("PASS  multi-chunk streaming"); }
    else { fail++; console.log("FAIL  multi-chunk streaming → " + JSON.stringify(paths)); }
}
await streamTest();

await rt("primitives in object", { a: 1, b: "x", c: null, d: true }, { a: 2, b: "y", c: false, d: null });
await rt("nested deep", { a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
await rt("array primitive append", { tags: ["a", "b"] }, { tags: ["a", "b", "c"] });
await rt("array primitive remove tail", { tags: ["a", "b", "c"] }, { tags: ["a", "b"] });

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
