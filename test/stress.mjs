// Worst-case stress tests: deep nesting, huge objects, pathological keys.
import { diff, applyPatch, toJsonPatch } from "../dist/index.js";

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
    if (cond) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? "  — " + detail : "")); }
}

// 1. Deep nesting — 50 levels deep
{
    let l = '"deep"';
    let r = '"DEEP"';
    for (let i = 0; i < 50; i++) {
        l = `{"k${i}":${l}}`;
        r = `{"k${i}":${r}}`;
    }
    const result = await diff(l, r);
    const path = result.entries[0]?.path ?? "";
    ok("50-level deep nesting", result.entries.length === 1 && path.split("/").length === 51);
}

// 2. Huge flat object — 5000 keys
{
    const l = { count: 5000 };
    const r = { count: 5000 };
    for (let i = 0; i < 5000; i++) {
        l["k" + i] = i;
        r["k" + i] = i;
    }
    r.k2500 = 999999;
    const result = await diff(JSON.stringify(l), JSON.stringify(r));
    ok("5000-key flat object — single change", result.entries.length === 1 && result.entries[0].path === "/k2500" && result.entries[0].rightValue === 999999);
}

// 3. Huge array — 5000 elements
{
    const l = Array.from({ length: 5000 }, (_, i) => i);
    const r = Array.from({ length: 5000 }, (_, i) => i);
    r[4999] = -1;
    const result = await diff(JSON.stringify(l), JSON.stringify(r));
    ok("5000-elem array — last-index change", result.entries.length === 1 && result.entries[0].path === "/4999" && result.entries[0].rightValue === -1);
}

// 4. Empty object / array
{
    const r1 = await diff('{}', '{"a":1}');
    ok("empty → add key", r1.entries.length === 1 && r1.entries[0].op === 0);
    const r2 = await diff('[]', '[1,2,3]');
    ok("empty array → add elements", r2.entries.length === 3);
}

// 5. Keys with special characters
{
    const l = JSON.stringify({ "a/b": 1, "x~y": 2, "with space": 3 });
    const r = JSON.stringify({ "a/b": 9, "x~y": 2, "with space": 3 });
    const result = await diff(l, r);
    ok("key with '/' — escaped per RFC 6901", result.entries[0]?.path === "/a~1b" && result.entries[0]?.rightValue === 9);
}

// 6. Identical large inputs
{
    const big = JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ id: i, name: "u" + i })));
    const result = await diff(big, big);
    ok("identical 1000-elem identical → 0 entries", result.entries.length === 0);
}

// 7. Object becomes array (type change of root)
{
    const result = await diff('{"a":1}', '[1,2,3]');
    ok("root type change object→array", result.entries.length > 0);
}

// 8. Large value (long string)
{
    const longStr = "x".repeat(50000);
    const l = JSON.stringify({ text: longStr });
    const r = JSON.stringify({ text: longStr + "y" });
    const result = await diff(l, r);
    ok("50KB string change",
        result.entries.length === 1 &&
        result.entries[0].path === "/text" &&
        result.entries[0].rightValue.length === 50001);
}

// 9. Numbers: very large, very small, negative, scientific
{
    const l = '{"big":9999999999999,"neg":-1.7976931348623157e+308,"tiny":5e-324}';
    const r = '{"big":1,"neg":-1.7976931348623157e+308,"tiny":5e-324}';
    const result = await diff(l, r);
    ok("extreme numbers — only changed entry", result.entries.length === 1 && result.entries[0].path === "/big");
}

// 10. Round-trip stress: huge change set
{
    const before = Array.from({ length: 100 }, (_, i) => ({ id: i, value: "v" + i }));
    const after = Array.from({ length: 100 }, (_, i) => ({ id: i, value: "V" + i })); // change every value
    const result = await diff(JSON.stringify(before), JSON.stringify(after));
    const reconstructed = applyPatch(before, result);
    ok("apply 100-change patch", JSON.stringify(reconstructed) === JSON.stringify(after));
}

// 11. Invalid JSON should not crash
{
    try {
        await diff('{"a":}', '{"a":1}');
        ok("malformed JSON throws (not crash)", false, "did not throw");
    } catch (err) {
        ok("malformed JSON throws (not crash)", err.message.length > 0);
    }
}

// 12. Nested arrays of arrays
{
    const l = JSON.stringify([[1, 2], [3, 4], [5, 6]]);
    const r = JSON.stringify([[1, 2], [3, 7], [5, 6]]);
    const result = await diff(l, r);
    ok("nested arrays — only changed leaf", result.entries.length === 1 && result.entries[0].path === "/1/1" && result.entries[0].rightValue === 7);
}

// 13. Mixed-depth array
{
    const l = JSON.stringify([1, [2, [3, [4, 5]]]]);
    const r = JSON.stringify([1, [2, [3, [4, 9]]]]);
    const result = await diff(l, r);
    ok("4-deep mixed array", result.entries.length === 1 && result.entries[0].path === "/1/1/1/1" && result.entries[0].rightValue === 9);
}

// 14. JSON Patch output is valid
{
    const l = JSON.stringify({ a: 1, b: 2, c: [1, 2, 3] });
    const r = JSON.stringify({ a: 1, b: 99, c: [1, 2, 3, 4] });
    const result = await diff(l, r);
    const patch = toJsonPatch(result);
    const allValid = patch.every(p => typeof p.op === "string" && typeof p.path === "string" && p.path.startsWith("/"));
    ok("toJsonPatch — every op has valid shape", allValid);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
