---
title: "diffcore vs jsondiffpatch: choosing a JSON diff library in 2026"
description: "Picking between diffcore and jsondiffpatch? Head-to-head comparison on output format, RFC 6902 interop, undo/redo support, bundle size, and runtime targets — with real benchmark numbers."
canonical: https://rust-wasm-library.vercel.app/vs/jsondiffpatch
keywords: ["diffcore vs jsondiffpatch", "jsondiffpatch alternative", "json diff library comparison", "rfc 6902 json patch"]
---

# diffcore vs jsondiffpatch — which JSON diff library should you use?

> **Short answer:** Pick **`diffcore`** if you want standard RFC 6902 JSON Patch output, built-in undo/redo and three-way merge, decoded JSON Pointer paths, and WebAssembly speed. Pick **`jsondiffpatch`** if you want a ready-made HTML diff viewer and built-in text-diff for long strings, and you don't mind the custom delta format.

Two of the most-installed JSON diff libraries on npm. They solve overlapping problems with very different design choices.

## At a glance

| | **diffcore** | **jsondiffpatch** |
|---|---|---|
| Output format | RFC 6901 JSON Pointer paths + decoded values | Custom delta object (mirror of input shape) |
| Apply / revert | `applyPatch` / `revertPatch` built-in | `patch` / `unpatch` built-in |
| RFC 6902 JSON Patch output | ✅ via `toJsonPatch()` — works with any IETF consumer | Only via a separate adapter |
| Three-way merge | ✅ `merge3()` with conflict detection | ❌ not built-in |
| Undo/redo helper | ✅ `createHistory()` — bounded, patch-based | ❌ |
| Tolerance comparators (date / number / case) | ✅ `diffWith()` | ❌ |
| React hook | ✅ `diffcore/react` | ❌ |
| CLI | ✅ `npx diffcore` | ❌ |
| Engine | Rust → WebAssembly | Pure JavaScript |
| Bundle size | ~38 KB WASM + ~10 KB JS | ~120 KB minified |
| Text diff inside strings | ❌ (use jsdiff for that) | ✅ via `diff-match-patch` |
| Built-in HTML formatter | ❌ (`formatDiff` is text only) | ✅ multiple formatters |
| 10 MB diff speed | ~55 ms | ~600 ms |
| First released | 2026 | 2012 |
| License | MIT | MIT |

## Code side-by-side — same task, both libraries

### Detect changes between two JSON documents

**diffcore:**

```ts
import { diff } from "diffcore";

const result = await diff(
  '{"users":[{"name":"Alice"}]}',
  '{"users":[{"name":"Bob"}]}'
);
console.log(result.entries[0]);
// {
//   op: 2,                  // Modified
//   path: "/users/0/name",  // RFC 6901 JSON Pointer
//   leftValue: "Alice",
//   rightValue: "Bob",
//   ...
// }
```

**jsondiffpatch:**

```ts
import * as jsondiffpatch from "jsondiffpatch";

const delta = jsondiffpatch.diff(
  { users: [{ name: "Alice" }] },
  { users: [{ name: "Bob" }] }
);
console.log(delta);
// {
//   users: { 0: { name: ["Alice", "Bob"] } }  // custom delta format
// }
```

Notice the shape difference: diffcore gives you a flat list of `{op, path, value}` records; jsondiffpatch gives you a tree mirroring the input.

### Emit standard RFC 6902 JSON Patch

**diffcore:**

```ts
import { toJsonPatch } from "diffcore";
const ops = toJsonPatch(await diff(a, b));
// [{ op: "replace", path: "/users/0/name", value: "Bob" }]
// ✅ directly usable by fast-json-patch.applyPatch, any IETF server
```

**jsondiffpatch:**

```ts
// Requires a third-party adapter — there's no built-in RFC 6902 output.
// You either write your own translator from the delta format, or
// install a separate package.
```

If you need RFC 6902 interoperability (the only patch format any non-JavaScript server will understand), diffcore is the default choice.

### Undo / redo

**diffcore:**

```ts
import { createHistory } from "diffcore/state";

const history = createHistory({ count: 0 }, { maxSize: 100 });
await history.push({ count: 1 });
await history.push({ count: 2 });
history.undo();   // { count: 1 }
history.undo();   // { count: 0 }
history.redo();   // { count: 1 }
```

**jsondiffpatch:**

```ts
// Roll your own — keep an array of deltas, manually patch and unpatch.
// Easy for short histories, harder once you need bounded memory and
// branch-on-edit semantics.
```

## When jsondiffpatch is actually the better pick

There are real cases where jsondiffpatch wins:

- **You need a polished HTML diff viewer right now.** jsondiffpatch ships `formatters.html` which produces a ready-made nested-tree view of any diff. diffcore's `formatDiff()` is text-only.
- **You need character-level diff inside long strings.** jsondiffpatch integrates with `diff-match-patch` to give you Google-style text diff for changed string values. diffcore reports string changes as `leftValue → rightValue` only.
- **You only run in the browser and bundle size doesn't matter** (e.g. browser extension, internal dashboard). The ~120 KB cost is acceptable when you're not on a public-facing page.
- **You depend on existing tooling that expects jsondiffpatch's delta format** (e.g. some Redux DevTools extensions, some Vue tooling).

## When diffcore is the better pick

- You need **RFC 6902 JSON Patch** for client/server sync, audit logs, or HTTP PATCH endpoints.
- You need **undo/redo**, **three-way merge**, or **conflict detection** without rolling them yourself.
- You're working with **large payloads** (>1 MB) where 4× speed matters in user-perceived latency.
- You're optimizing for **bundle size** in a public-facing app (38 KB WASM + 10 KB JS vs 120 KB pure JS).
- You need **JSON Pointer paths** (`/users/0/name`) for any downstream tool that consumes them.
- You're working in a **non-browser runtime** — Cloudflare Workers, Vercel Edge, Deno, Bun — where WASM is a first-class citizen and bundle size is policed strictly.

## Migrating from jsondiffpatch to diffcore

The migration is mostly a different output shape — most apps only consume the diff to either re-render a UI or sync state, and both libraries cover both.

```ts
// Before — jsondiffpatch
import * as jsondiffpatch from "jsondiffpatch";
const delta = jsondiffpatch.diff(a, b);
const patched = jsondiffpatch.patch(a, delta);

// After — diffcore
import { diff, applyPatch } from "diffcore";
const result = await diff(JSON.stringify(a), JSON.stringify(b));
const patched = applyPatch(a, result);
```

Three caveats:

1. `diff()` is **async** in diffcore (loads the WASM module lazily and caches).
2. Pass JSON **strings** to diffcore (not parsed objects). The engine parses + diffs in one pass.
3. The output shape is a flat list of `{op, path, ...}` records, not a nested tree. If your downstream code reads the delta tree directly, you'll need to adapt — but most apps use the apply / unpatch path, which is unchanged.

## Get started

```bash
npm install diffcore
```

Full README + AGENTS.md + cookbook at <https://github.com/DibbayajyotiRoy/rust-wasm-Library>. Star it if it helps you.

## See also

- [diffcore vs fast-json-patch](./diffcore-vs-fast-json-patch.md)
- [diffcore vs microdiff](./diffcore-vs-microdiff.md)
- [diffcore vs deep-diff](./diffcore-vs-deep-diff.md)
