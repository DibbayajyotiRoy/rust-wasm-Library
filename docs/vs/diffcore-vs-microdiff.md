---
title: "diffcore vs microdiff: small, fast, or full-featured?"
description: "microdiff is 5 KB. diffcore is 48 KB. Side-by-side comparison of API, output format, applyPatch support, RFC 6902 interop, and when each is the right choice."
canonical: https://rust-wasm-library.vercel.app/vs/microdiff
keywords: ["diffcore vs microdiff", "microdiff alternative", "small json diff", "fast json diff", "json diff bundle size"]
---

# diffcore vs microdiff — small and fast, or full-featured?

> **Short answer:** Pick **`microdiff`** if you need a tiny (~5 KB), zero-dependency diff function and you'll handle apply, merge, and serialization yourself. Pick **`diffcore`** if you want a batteries-included library — applyPatch, revertPatch, RFC 6902 output, undo/redo, three-way merge, React hook, and CLI — and 48 KB is fine.

These are the two best modern JSON diff libraries on npm. They have very different scopes.

## At a glance

| | **diffcore** | **microdiff** |
|---|---|---|
| Output format | RFC 6901 JSON Pointer strings (`/users/0/name`) | Path array (`["users", 0, "name"]`) |
| Bundle size | ~38 KB WASM + ~10 KB JS | **~5 KB JS** |
| Engine | Rust → WebAssembly | Pure JavaScript |
| Apply patch | ✅ `applyPatch` built-in | ❌ — you write it |
| Revert patch | ✅ `revertPatch` built-in | ❌ — you write it |
| RFC 6902 JSON Patch output | ✅ via `toJsonPatch()` | ❌ — you adapt the records yourself |
| Three-way merge | ✅ `merge3()` | ❌ |
| Undo/redo helper | ✅ `createHistory()` | ❌ |
| React hook | ✅ `diffcore/react` | ❌ |
| CLI tool | ✅ `npx diffcore` | ❌ |
| Tolerance comparators | ✅ `diffWith()` + helpers | ❌ |
| Ignore / scope filters | ✅ `{ ignore: [...], scope: "/x" }` | ❌ |
| 10 MB diff speed | ~55 ms (WASM, one pass) | ~180 ms |
| Small-payload diff (<10 KB) speed | ~0.4 ms | ~0.2 ms — **microdiff is faster here** |
| Zero runtime dependencies | ✅ | ✅ |
| First released | 2026 | 2021 |
| License | MIT | MIT |

## Code side-by-side — same task

### Detect changes between two objects

**microdiff:**

```ts
import microdiff from "microdiff";

const changes = microdiff(
  { users: [{ name: "Alice" }] },
  { users: [{ name: "Bob" }] }
);
console.log(changes[0]);
// {
//   type: "CHANGE",
//   path: ["users", 0, "name"],   // path as an array of segments
//   value: "Bob",
//   oldValue: "Alice"
// }
```

**diffcore:**

```ts
import { diff } from "diffcore";

const result = await diff(
  '{"users":[{"name":"Alice"}]}',
  '{"users":[{"name":"Bob"}]}'
);
console.log(result.entries[0]);
// {
//   op: 2,                          // Modified
//   path: "/users/0/name",          // RFC 6901 JSON Pointer string
//   leftValue: "Alice",
//   rightValue: "Bob",
//   ...
// }
```

Two important differences:

1. **microdiff is sync, diffcore is async** (loads the WASM lazily on the first call, then caches).
2. **microdiff's path is an array**; **diffcore's path is a JSON Pointer string**. The string format is what RFC 6902, `fast-json-patch`, every IETF JSON Patch endpoint, and most server-side patch consumers expect. The array format is faster to compose programmatically and avoids escape-character ambiguity.

### Apply changes

**microdiff:**

```ts
// Roll your own:
function applyChanges(target, changes) {
  const copy = JSON.parse(JSON.stringify(target));
  for (const c of changes) {
    let cursor = copy;
    for (let i = 0; i < c.path.length - 1; i++) cursor = cursor[c.path[i]];
    const lastKey = c.path[c.path.length - 1];
    if (c.type === "CREATE" || c.type === "CHANGE") cursor[lastKey] = c.value;
    else if (c.type === "REMOVE") delete cursor[lastKey];
  }
  return copy;
}
```

**diffcore:**

```ts
import { applyPatch } from "diffcore";
const patched = applyPatch(target, result);  // done.
```

The handwritten function above isn't *hard*, but it misses edge cases: array `splice` vs `delete`, empty object cleanup, lenient mode for missing paths. diffcore's `applyPatch` handles those.

### Emit RFC 6902 JSON Patch

**microdiff:**

```ts
// Adapter you write yourself:
function toJsonPatch(changes) {
  return changes.map((c) => {
    const path = "/" + c.path
      .map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1"))
      .join("/");
    if (c.type === "CREATE") return { op: "add",     path, value: c.value };
    if (c.type === "REMOVE") return { op: "remove",  path };
    return                          { op: "replace", path, value: c.value };
  });
}
```

**diffcore:**

```ts
import { toJsonPatch } from "diffcore";
const ops = toJsonPatch(result);
```

## When microdiff is the right pick

microdiff is genuinely great for these:

- **Tight bundle budgets.** Browser-extension code paths, third-party SDKs (analytics, chat widgets), or marketing-site JS where every KB is scrutinized. 5 KB is hard to beat.
- **In-process diff that never leaves the runtime.** State observers, signal-driven reactivity, dev-only assertions. The path-array shape is fine when you never serialize it.
- **Small payloads, lots of calls.** microdiff is faster than diffcore for sub-10 KB inputs because there's no WASM instantiation cost per call.
- **Zero-WASM runtimes.** Some constrained edge or embedded JS runtimes don't support WebAssembly. microdiff works everywhere `Object.keys` works.

## When diffcore is the right pick

- You need to **serialize the diff** — send it over HTTP, store it in a database, replay it later. RFC 6902 with JSON Pointer strings is the lingua franca; diffcore emits it natively.
- You need **apply/revert** without writing it yourself, with the edge cases handled (whole-array-element additions, empty-shell cleanup, lenient mode).
- You need **state management primitives** — undo/redo, three-way merge, conflict detection, tolerance comparators. None of these exist in microdiff.
- You're diffing **large payloads** (>1 MB) where the WASM speed advantage actually shows up.
- You want a **CLI** for CI pipelines (`npx diffcore a.json b.json --silent`).

## Migrating between them

Migration in either direction is just a path-format adapter. If you're moving from microdiff to diffcore:

```ts
// Before
import microdiff from "microdiff";
const changes = microdiff(prev, next);

// After
import { diff } from "diffcore";
const result = await diff(JSON.stringify(prev), JSON.stringify(next));
// result.entries has the same content; path is a string instead of array.
```

The main practical change is `diff()` becomes `await` and you pass JSON strings instead of objects.

## You can use both — different jobs

A common pattern in our experience: microdiff in the client SDK (where bundle size dominates), diffcore on the server (where features and standard formats dominate). Both speak the same JSON over the wire when you adapt the path shape.

## Get started

```bash
npm install diffcore
```

Or, if you want the tiny version:

```bash
npm install microdiff
```

## See also

- [diffcore vs jsondiffpatch](./diffcore-vs-jsondiffpatch.md)
- [diffcore vs fast-json-patch](./diffcore-vs-fast-json-patch.md)
- [diffcore vs deep-diff](./diffcore-vs-deep-diff.md)
