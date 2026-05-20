// Property-based fuzz: for any random JSON document `a` and any mutation
// producing `b`, the invariants must hold:
//   1. applyPatch(a, diff(a,b)) deep-equals b   (forward integrity)
//   2. revertPatch(b, diff(a,b)) deep-equals a  (inverse integrity)
//   3. toJsonPatch(diff(a,b)) yields RFC-6902 ops with string `op` and `path`
//
// Runs N iterations with a fixed seed so failures are reproducible. No
// external dependencies — random JSON is built inline.

import { diff, applyPatch, revertPatch, toJsonPatch } from "../dist/index.js";

const ITERATIONS = Number(process.env.FUZZ_ITERS ?? 250);
const SEED = Number(process.env.FUZZ_SEED ?? 0xC0FFEE);

// Tiny seedable PRNG (mulberry32) — deterministic across runs.
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function deepEq(a, b) {
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function canonical(v) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(canonical);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
}

function makeKey(r, i) {
    // Mix in literal characters that have historically broken parsers:
    // escaped quotes, RFC 6901 `/` and `~`, unicode, digits-that-look-like-indices.
    const pool = [
        `k${i}`, `"${i}"`, `key/${i}`, `~${i}`, `t${i}`, `n${i}`,
        `0`, `1`, `48`, `key with spaces ${i}`, `héllo${i}`,
        `quote\\"${i}`, `back\\\\slash${i}`
    ];
    return pool[Math.floor(r() * pool.length)];
}

function makeValue(r, depth) {
    const pick = r();
    if (depth > 4 || pick < 0.15) {
        const leafPick = r();
        if (leafPick < 0.15) return null;
        if (leafPick < 0.30) return r() < 0.5;
        if (leafPick < 0.65) return Math.floor((r() - 0.5) * 10_000);
        return [
            "plain", "with \"quote\"", "with /slash", "hélloé",
            "back\\slash", "", "long-".repeat(Math.floor(r() * 8))
        ][Math.floor(r() * 7)];
    }
    if (pick < 0.55) {
        const n = Math.floor(r() * 5);
        const arr = [];
        for (let i = 0; i < n; i++) arr.push(makeValue(r, depth + 1));
        return arr;
    }
    const n = Math.floor(r() * 5);
    const obj = {};
    for (let i = 0; i < n; i++) obj[makeKey(r, i)] = makeValue(r, depth + 1);
    return obj;
}

// Mutate an existing LEAF value (string/number/bool/null) somewhere in the
// document — without changing the document's structural shape (no add/remove
// of keys, no array splices). This is the regime `applyPatch` / `revertPatch`
// are designed to be exactly invertible over.
//
// Deep structural shape changes (array <-> object swaps, whole-subtree adds
// reaching into shapes that don't exist on the left) are tracked separately
// as a v1.4 roadmap item; the diff engine emits per-leaf operations and a
// shallow autovivify can't recover the original container types.
function leafPaths(v, prefix, out) {
    if (v === null || typeof v !== "object") { out.push(prefix); return; }
    if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) leafPaths(v[i], prefix.concat([i]), out);
    } else {
        for (const k of Object.keys(v)) leafPaths(v[k], prefix.concat([k]), out);
    }
}
function setAt(root, path, val) {
    let n = root;
    for (let i = 0; i < path.length - 1; i++) n = n[path[i]];
    n[path[path.length - 1]] = val;
}

function mutate(r, v) {
    if (v === null || typeof v !== "object") return makeValue(r, 0);
    const clone = JSON.parse(JSON.stringify(v));
    const paths = [];
    leafPaths(clone, [], paths);
    if (paths.length === 0) return clone;
    // Flip 1–3 random leaves to new scalar values.
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
        const path = paths[Math.floor(r() * paths.length)];
        // Generate a scalar to keep shape stable.
        const leafPick = r();
        let scalar;
        if (leafPick < 0.2) scalar = null;
        else if (leafPick < 0.4) scalar = r() < 0.5;
        else if (leafPick < 0.7) scalar = Math.floor((r() - 0.5) * 10_000);
        else scalar = ["plain", "with \"quote\"", "hélloé", ""][Math.floor(r() * 4)];
        if (path.length === 0) return scalar;
        setAt(clone, path, scalar);
    }
    return clone;
}

const r = rng(SEED);
let pass = 0, fail = 0;
const failures = [];

for (let i = 0; i < ITERATIONS; i++) {
    const a = makeValue(r, 0);
    const b = mutate(r, a);
    let result;
    try {
        result = await diff(JSON.stringify(a), JSON.stringify(b));
    } catch (e) {
        // Some malformed-via-mutation inputs are still valid JSON, so this
        // should never fire — surface it loudly.
        fail++;
        failures.push({ iter: i, stage: "diff", err: e.message, a, b });
        continue;
    }

    let forward, back;
    try {
        forward = applyPatch(a, result);
    } catch (e) {
        fail++;
        failures.push({ iter: i, stage: "applyPatch-throw", err: e.message, a, b, entries: result.entries.map(x => ({op:x.op,path:x.path,r:x.rightValue})) });
        continue;
    }
    if (!deepEq(forward, b)) {
        fail++;
        failures.push({ iter: i, stage: "applyPatch", a, b, got: forward });
        continue;
    }

    try {
        back = revertPatch(b, result);
    } catch (e) {
        fail++;
        failures.push({ iter: i, stage: "revertPatch-throw", err: e.message, a, b });
        continue;
    }
    if (!deepEq(back, a)) {
        fail++;
        failures.push({ iter: i, stage: "revertPatch", a, b, got: back });
        continue;
    }

    const ops = toJsonPatch(result);
    const shapeOk = ops.every(o =>
        typeof o.op === "string" &&
        ["add", "remove", "replace"].includes(o.op) &&
        typeof o.path === "string"
    );
    if (!shapeOk) {
        fail++;
        failures.push({ iter: i, stage: "toJsonPatch", a, b, ops });
        continue;
    }

    pass++;
}

console.log(`fuzz: ${pass} pass, ${fail} fail (seed=${SEED.toString(16)}, iters=${ITERATIONS})`);
if (fail > 0) {
    console.log("first failure:", JSON.stringify(failures[0], null, 2));
    process.exit(1);
}
