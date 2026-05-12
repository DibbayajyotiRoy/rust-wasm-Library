// New v1.2 features: equals(), ignore, scope, toJSON().
import { diff, equals, DiffOp } from "../dist/index.js";

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
    if (cond) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? "  — " + detail : "")); }
}

// equals() — identical
ok("equals: identical primitives", await equals('{"a":1}', '{"a":1}'));
ok("equals: identical complex", await equals(
    JSON.stringify({ u: [{ id: 1 }, { id: 2 }] }),
    JSON.stringify({ u: [{ id: 1 }, { id: 2 }] })
));
ok("equals: different", !(await equals('{"a":1}', '{"a":2}')));
ok("equals: reference-equal strings short-circuit", await equals('{"a":1}', '{"a":1}'));

// equals() with ignore
ok("equals: differs only in /timestamp (without ignore) → false",
    !(await equals('{"a":1,"timestamp":100}', '{"a":1,"timestamp":200}')));
ok("equals: differs only in /timestamp (with ignore) → true",
    await equals('{"a":1,"timestamp":100}', '{"a":1,"timestamp":200}', { ignore: ["/timestamp"] }));

// ignore — drops entries under a path
{
    const r = await diff(
        '{"a":1,"_meta":{"id":"x","ver":1}}',
        '{"a":2,"_meta":{"id":"y","ver":2}}',
        { ignore: ["/_meta"] }
    );
    ok("ignore /_meta drops both /id and /ver entries",
        r.entries.length === 1 && r.entries[0].path === "/a");
}

// ignore — multiple paths
{
    const r = await diff(
        '{"a":1,"b":2,"c":3}',
        '{"a":9,"b":8,"c":7}',
        { ignore: ["/a", "/b"] }
    );
    ok("ignore: multiple paths", r.entries.length === 1 && r.entries[0].path === "/c");
}

// scope — keeps only entries under a subtree
{
    const r = await diff(
        '{"users":[{"name":"A"}],"products":[{"name":"X"}]}',
        '{"users":[{"name":"B"}],"products":[{"name":"Y"}]}',
        { scope: "/users" }
    );
    ok("scope /users drops /products entries",
        r.entries.length === 1 && r.entries[0].path === "/users/0/name" && r.entries[0].rightValue === "B");
}

// scope + ignore combine
{
    const r = await diff(
        '{"users":[{"name":"A","_internal":1}]}',
        '{"users":[{"name":"B","_internal":2}]}',
        { scope: "/users", ignore: ["/users/0/_internal"] }
    );
    ok("scope + ignore combine",
        r.entries.length === 1 && r.entries[0].path === "/users/0/name");
}

// toJSON() — serializes without bigint errors
{
    const result = await diff('{"a":1}', '{"a":2}');
    try {
        const wire = JSON.stringify(result.toJSON());
        const parsed = JSON.parse(wire);
        ok("toJSON: produces JSON.stringify-safe object",
            parsed.entries.length === 1 &&
            parsed.entries[0].path === "/a" &&
            typeof parsed.entries[0].pathId === "string");
    } catch (err) {
        ok("toJSON: produces JSON.stringify-safe object", false, err.message);
    }
}

// toJSON() — round-trip via JSON (no Uint8Array, no bigint leakage)
{
    const result = await diff(
        '{"users":[{"name":"Alice"}]}',
        '{"users":[{"name":"Bob"}]}'
    );
    const wire = JSON.stringify(result.toJSON());
    const parsed = JSON.parse(wire);
    ok("toJSON: pathId becomes hex string",
        typeof parsed.entries[0].pathId === "string" && /^[0-9a-f]+$/.test(parsed.entries[0].pathId));
    ok("toJSON: leftValue / rightValue preserved",
        parsed.entries[0].leftValue === "Alice" && parsed.entries[0].rightValue === "Bob");
    ok("toJSON: leftBytes / rightBytes omitted",
        parsed.entries[0].leftBytes === undefined && parsed.entries[0].rightBytes === undefined);
}

// Sanity: ignored entries don't appear in toJSON output
{
    const result = await diff(
        '{"a":1,"ts":100}',
        '{"a":2,"ts":200}',
        { ignore: ["/ts"] }
    );
    const wire = result.toJSON();
    ok("ignore + toJSON: /ts not present in serialized output",
        wire.entries.length === 1 && wire.entries[0].path === "/a");
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
