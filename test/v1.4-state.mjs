// v1.4 state-management primitives: createHistory, detectConflicts, merge3, comparators.
import { diff } from "../dist/index.js";
import {
    createHistory,
    detectConflicts,
    merge3,
    MergeConflictError,
    diffWith,
    dateTolerance,
    numericTolerance,
    caseInsensitive,
} from "../dist/state.js";

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
    if (cond) { pass++; console.log("PASS  " + name); }
    else { fail++; console.log("FAIL  " + name + (detail ? "  — " + detail : "")); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// === createHistory ===
{
    const h = createHistory({ count: 0, tags: [] });
    await h.push({ count: 1, tags: ["a"] });
    await h.push({ count: 2, tags: ["a", "b"] });

    ok("history: size after two pushes", h.size() === 2);
    ok("history: canUndo true", h.canUndo());
    ok("history: canRedo false (fresh push)", !h.canRedo());

    const u1 = h.undo();
    ok("history: first undo restores state-1", eq(u1, { count: 1, tags: ["a"] }));

    const u2 = h.undo();
    ok("history: second undo restores initial", eq(u2, { count: 0, tags: [] }));

    const u3 = h.undo();
    ok("history: undo past start returns null", u3 === null);

    const r1 = h.redo();
    ok("history: redo restores state-1", eq(r1, { count: 1, tags: ["a"] }));

    const r2 = h.redo();
    ok("history: redo restores state-2", eq(r2, { count: 2, tags: ["a", "b"] }));

    const r3 = h.redo();
    ok("history: redo past end returns null", r3 === null);
}

// Bounded history size
{
    const h = createHistory({ n: 0 }, { maxSize: 3 });
    for (let i = 1; i <= 5; i++) await h.push({ n: i });
    ok("history: bounded to maxSize=3", h.size() === 3);
}

// === detectConflicts ===
{
    const base = '{"a":1,"b":2,"c":3}';
    const branchA = '{"a":10,"b":2,"c":30}'; // edits /a and /c
    const branchB = '{"a":20,"b":200,"c":3}'; // edits /a and /b

    const patchA = await diff(base, branchA);
    const patchB = await diff(base, branchB);
    const conflicts = detectConflicts(patchA, patchB);
    ok("conflicts: detect overlap at /a", conflicts.length === 1 && conflicts[0].path === "/a");
    ok("conflicts: report both values", conflicts[0].a.value === 10 && conflicts[0].b.value === 20);
    ok("conflicts: sameOutcome=false when values differ", conflicts[0].sameOutcome === false);
}

// detectConflicts — sameOutcome
{
    const base = '{"x":1}';
    const a = '{"x":99}';
    const b = '{"x":99}';
    const conflicts = detectConflicts(await diff(base, a), await diff(base, b));
    ok("conflicts: sameOutcome=true when both wrote same value", conflicts.length === 1 && conflicts[0].sameOutcome === true);
}

// === merge3 ===
{
    const base  = { a: 1, b: 2, c: 3 };
    const aOnly = { a: 10, b: 2, c: 3 };   // only edits /a
    const bOnly = { a: 1,  b: 20, c: 3 };  // only edits /b

    const result = await merge3(base, aOnly, bOnly);
    ok("merge3: non-overlapping edits both apply",
        eq(result.value, { a: 10, b: 20, c: 3 }));
    ok("merge3: no conflicts when paths disjoint", result.conflicts.length === 0);
}

// merge3 — throw on conflict
{
    const base = { x: 1 };
    const a = { x: 2 };
    const b = { x: 3 };
    let threw = false;
    try {
        await merge3(base, a, b, { strategy: "throw" });
    } catch (err) {
        threw = err instanceof MergeConflictError && err.conflicts.length === 1;
    }
    ok("merge3: 'throw' strategy raises MergeConflictError", threw);
}

// merge3 — prefer-a / prefer-b
{
    const base = { x: 1 };
    const a = { x: 2 };
    const b = { x: 3 };
    const r1 = await merge3(base, a, b, { strategy: "prefer-a" });
    ok("merge3: prefer-a uses A's value", r1.value.x === 2 && r1.conflicts.length === 1);
    const r2 = await merge3(base, a, b, { strategy: "prefer-b" });
    ok("merge3: prefer-b uses B's value", r2.value.x === 3 && r2.conflicts.length === 1);
}

// merge3 — same outcome on both sides does NOT throw
{
    const base = { x: 1 };
    const r = await merge3(base, { x: 99 }, { x: 99 }, { strategy: "throw" });
    ok("merge3: sameOutcome doesn't throw under 'throw' strategy", r.value.x === 99);
}

// === diffWith + comparators ===
{
    const a = '{"createdAt":"2025-01-01T00:00:00.000Z","score":1.0}';
    const b = '{"createdAt":"2025-01-01T00:00:00.500Z","score":1.005}';

    const noisy = await diff(a, b);
    ok("diffWith: without comparators, both fields appear", noisy.entries.length === 2);

    const filtered = await diffWith(a, b, {
        "/createdAt": dateTolerance(1000),    // within 1 second
        "/score": numericTolerance(0.01),     // within 0.01
    });
    ok("diffWith: tolerant comparators drop noisy entries", filtered.entries.length === 0);
}

// caseInsensitive
{
    const a = '{"name":"Alice"}';
    const b = '{"name":"alice"}';
    const filtered = await diffWith(a, b, { "/name": caseInsensitive() });
    ok("caseInsensitive: 'Alice' equals 'alice'", filtered.entries.length === 0);
}

// Tolerances DON'T drop entries that exceed them
{
    const a = '{"score":1.0}';
    const b = '{"score":2.0}';
    const filtered = await diffWith(a, b, { "/score": numericTolerance(0.01) });
    ok("tolerance: large delta still reported", filtered.entries.length === 1);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
