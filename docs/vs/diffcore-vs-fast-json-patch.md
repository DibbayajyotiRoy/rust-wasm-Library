---
title: "diffcore vs fast-json-patch: when to use which"
description: "Comparing diffcore and fast-json-patch for RFC 6902 JSON Patch workflows. Apply-only vs diff+apply, maintenance status, bundle size, and three-way merge support."
canonical: https://rust-wasm-library.vercel.app/vs/fast-json-patch
keywords: ["diffcore vs fast-json-patch", "fast-json-patch alternative", "rfc 6902", "json patch library", "json patch generator"]
---

# diffcore vs fast-json-patch — which JSON Patch library should you use?

> **Short answer:** Pick **`fast-json-patch`** if you only need to **apply** RFC 6902 JSON Patch documents authored elsewhere, with strict spec compliance. Pick **`diffcore`** if you need to **generate** the patches too, want active maintenance, undo/redo, three-way merge, or WebAssembly speed.

`fast-json-patch` and `diffcore` both speak RFC 6902 — but they're optimized for different sides of the patch lifecycle.

## At a glance

| | **diffcore** | **fast-json-patch** |
|---|---|---|
| Generate RFC 6902 patches | ✅ via `toJsonPatch(await diff(a, b))` — one-shot structural diff | ⚠ via `observe()` mode (mutation tracking, slower) |
| Apply RFC 6902 patches | ✅ `applyPatch` — works on the diffcore output | ✅ `applyPatch` — gold-standard spec implementation |
| Revert / inverse patch | ✅ `revertPatch` — handles whole-array-element additions cleanly | ❌ |
| Three-way merge | ✅ `merge3()` | ❌ |
| Undo/redo helper | ✅ `createHistory()` | ❌ |
| Engine | Rust → WebAssembly | Pure JavaScript |
| Last released | 2026 — actively maintained | **2022-03-24 — 4 years stale** |
| Bundle size | ~48 KB total | ~25 KB |
| 10 MB diff speed | ~55 ms | seconds (via `observe()` mode) |
| `test` op for preconditions | partial — via your own pre-check | ✅ first-class |
| `move` / `copy` ops | output is `add` + `remove` (more verbose but more portable) | ✅ first-class |
| TypeScript types | ✅ first-party | ✅ first-party |
| License | MIT | MIT |

## Code side-by-side — generate a patch

**diffcore (one-shot, fast):**

```ts
import { diff, toJsonPatch } from "diffcore";

const ops = toJsonPatch(await diff(
  JSON.stringify({ a: 1, b: 2 }),
  JSON.stringify({ a: 1, b: 3, c: 4 })
));
// [
//   { op: "replace", path: "/b", value: 3 },
//   { op: "add",     path: "/c", value: 4 }
// ]
```

**fast-json-patch (`observe()` mode — patches are emitted via mutation tracking):**

```ts
import { observe, generate } from "fast-json-patch";

const doc = { a: 1, b: 2 };
const observer = observe(doc);
doc.b = 3;
doc.c = 4;
const ops = generate(observer);
// [
//   { op: "replace", path: "/b", value: 3 },
//   { op: "add",     path: "/c", value: 4 }
// ]
```

`fast-json-patch`'s `observe()` only sees changes made *through the observed object* — it doesn't structurally compare two different documents. So it works for "this object got edited," but not for "here are two states from elsewhere, what's the diff?" For the latter, you'd use a separate diff library — likely diffcore.

## Code side-by-side — apply a patch

Both libraries are conformant here; the choice is whether you want a separate apply-only dependency or roll diff + apply into one.

**diffcore:**

```ts
import { applyPatch } from "diffcore";
const patched = applyPatch(doc, ops);  // accepts RFC 6902 ops or diffcore entries
```

**fast-json-patch:**

```ts
import { applyPatch } from "fast-json-patch";
const result = applyPatch(doc, ops, /* validate */ true);
const patched = result.newDocument;
```

`fast-json-patch` returns a result object with metadata and supports the RFC 6902 `test` op natively. diffcore's `applyPatch` is a smaller surface but covers the common case.

## Maintenance status — the elephant in the room

`fast-json-patch` is the most-installed RFC 6902 library on npm (~6.9 million weekly downloads at the time of writing) but **hasn't shipped a release since 2022-03-24**. That's not necessarily bad — the RFC 6902 spec hasn't changed since 2013, so a stable implementation can be "done" — but it does mean:

- No support for Node.js / runtime / TypeScript feature improvements made after early 2022.
- Several open issues around edge-case escaping (paths containing `~` and `/`) remain unaddressed.
- Bug-fixes only land if a maintainer is paying attention to PRs.

`diffcore` ships releases on a regular cadence (latest: 2026-05-12) and is actively iterated on. For greenfield projects in 2026 starting from scratch, that's a meaningful difference.

## When fast-json-patch is the right choice

- **Apply-only workflow.** You receive RFC 6902 patches from clients, partners, or non-JS systems and just need to apply them with strict spec conformance.
- **`test` op required.** Your patch protocol uses `test` for optimistic locking; fast-json-patch implements this natively.
- **Existing codebase already depends on it.** Migrating away is rarely worth it just for activity signals.
- **Bundle size is critical** and you're not generating diffs. The 25 KB pure-JS size beats diffcore's 48 KB by a meaningful margin in tight budgets.

## When diffcore is the right choice

- You need both **generate and apply** in the same library.
- You want **active maintenance** as a trust signal.
- You're handling **large payloads** (>1 MB) where the structural diff is much faster than mutation tracking.
- You need **undo/redo**, **three-way merge**, or **conflict detection** without rolling them yourself.
- You want **`revertPatch`** (inverse of applyPatch) — fast-json-patch doesn't offer this.

## Migrating from fast-json-patch to diffcore

If you're using fast-json-patch only to apply patches you generate elsewhere, no migration needed — keep it. If you're using `observe()` mode to generate patches, that's the migration:

```ts
// Before — fast-json-patch observe-and-generate
import { observe, generate, applyPatch } from "fast-json-patch";
const observer = observe(doc);
// ... mutate doc ...
const ops = generate(observer);

// After — diffcore one-shot
import { diff, toJsonPatch, applyPatch } from "diffcore";
const before = structuredClone(doc);  // capture state before mutations
// ... mutate ...
const ops = toJsonPatch(
  await diff(JSON.stringify(before), JSON.stringify(doc))
);
```

The mental model shift: diffcore wants two **states** to compare. fast-json-patch's `observe()` watches one object **over time**. Both produce the same RFC 6902 output for typical use cases.

## You can use both together

A common pattern: generate with diffcore (faster, structural), apply with fast-json-patch (strict spec validation, `test` op support):

```ts
import { diff, toJsonPatch } from "diffcore";
import { applyPatch } from "fast-json-patch";

const ops = toJsonPatch(await diff(JSON.stringify(prev), JSON.stringify(next)));
const result = applyPatch(prev, ops, /* validate */ true);
```

This is a perfectly reasonable architecture for systems with strict spec requirements.

## Get started with diffcore

```bash
npm install diffcore
```

Full docs at <https://github.com/DibbayajyotiRoy/rust-wasm-Library>.

## See also

- [diffcore vs jsondiffpatch](./diffcore-vs-jsondiffpatch.md)
- [diffcore vs microdiff](./diffcore-vs-microdiff.md)
- [diffcore vs deep-diff](./diffcore-vs-deep-diff.md)
