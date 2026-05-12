# diffcore

> Fast WebAssembly JSON diff for JavaScript & TypeScript. Returns **real JSON Pointer paths** and **decoded values** — not opaque hashes. Plug-and-play with `applyPatch`, `revertPatch`, and standard **RFC 6902 JSON Patch** output. Ships a **React hook** and a **CLI**.

[![npm version](https://img.shields.io/npm/v/diffcore.svg)](https://www.npmjs.com/package/diffcore)
[![npm downloads](https://img.shields.io/npm/dw/diffcore.svg)](https://www.npmjs.com/package/diffcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/diffcore)](https://bundlephobia.com/package/diffcore)

```bash
npm install diffcore
```

```ts
import { diff } from "diffcore";

const result = await diff(
  '{"users":[{"name":"Alice","role":"admin"}]}',
  '{"users":[{"name":"Alice","role":"owner"}]}'
);

for (const e of result.entries) {
  console.log(e.op, e.path, e.leftValue, "→", e.rightValue);
  // 2 (Modified)  /users/0/role  "admin" → "owner"
}
```

---

## Why diffcore

- **Real JSON Pointer paths** (`/users/0/role`) per RFC 6901 — not the opaque hashes you get from many low-level engines.
- **Decoded leaf values** (`string | number | boolean | null`) so you can use the diff directly in app code — no manual lookup against the source bytes.
- **RFC 6902 JSON Patch** output (`toJsonPatch(result)`) — interoperable with `fast-json-patch`, `jsondiffpatch`, and the IETF spec.
- **`applyPatch` and `revertPatch`** built-in — round-trips work for primitives, leaf changes, and whole-array-element additions. Drop-in for undo/redo, state sync, and optimistic UI.
- **WebAssembly speed**: 3–4× faster than optimized JS diff, 350–500 MB/s sustained throughput.
- **Zero config**: WASM is embedded as Base64, no toolchain or extra files required.
- **Auto memory cleanup** via `FinalizationRegistry` — no manual `.destroy()` calls needed.
- **Ships everywhere**: Node 18+, browsers (Chrome 89+/Firefox 89+/Safari 15+), Bun, Deno, Cloudflare Workers, Vercel Edge, Electron, Tauri.

---

## Common use cases

| You want to… | Use this |
|---|---|
| Compare two JSON documents and see what changed | `diff(a, b)` |
| Check if two JSON values are structurally equal | `equals(a, b)` *(v1.2)* |
| Ignore noisy fields (timestamps, IDs) | `diff(a, b, { ignore: ["/timestamp"] })` *(v1.2)* |
| Diff only a subtree | `diff(a, b, { scope: "/users" })` *(v1.2)* |
| Send a diff over the wire | `JSON.stringify(result.toJSON())` *(v1.2)* |
| Sync state between client and server | `diff(a, b)` + `toJsonPatch()` over the wire |
| Build an undo/redo stack | `createHistory(initialState)` from `diffcore/state` *(v1.2)* |
| Merge edits from two branches | `merge3(base, a, b)` from `diffcore/state` *(v1.2)* |
| Detect conflicting edits between two patches | `detectConflicts(patchA, patchB)` *(v1.2)* |
| Tolerant equality (dates within N ms, numbers within ε) | `diffWith(a, b, { "/at": dateTolerance(1000) })` *(v1.2)* |
| Show a "review changes" UI in React | `useDiff(prev, next)` from `diffcore/react` |
| Get a colored diff in your CLI / CI logs | `npx diffcore before.json after.json` |
| Emit standard JSON Patch over an HTTP API | `toJsonPatch(diff(a, b))` |
| Replay diffs against a different starting document | `applyPatch(otherDoc, diff)` (lenient mode optional) |
| Diff a multi-gigabyte file without loading it all | `createEngine()` + `pushLeft/pushRight` chunks |
| Diff JSON in a Web Worker so the UI stays at 60fps | `import { DiffCoreWorker } from "diffcore/worker"` |

---

## Quick start

### One-shot diff

```ts
import { diff, DiffOp } from "diffcore";

const result = await diff(oldJson, newJson);

for (const e of result.entries) {
  switch (e.op) {
    case DiffOp.Added:    console.log(`+ ${e.path} = ${JSON.stringify(e.rightValue)}`); break;
    case DiffOp.Removed:  console.log(`- ${e.path}`); break;
    case DiffOp.Modified: console.log(`~ ${e.path}: ${JSON.stringify(e.leftValue)} → ${JSON.stringify(e.rightValue)}`); break;
  }
}
```

### Apply and revert patches

```ts
import { diff, applyPatch, revertPatch } from "diffcore";

const before = { count: 1, tags: ["a", "b"] };
const after  = { count: 2, tags: ["a", "b", "c"] };

const result = await diff(JSON.stringify(before), JSON.stringify(after));

const reconstructed = applyPatch(before, result);
// → { count: 2, tags: ["a", "b", "c"] }   ✓ equals `after`

const undone = revertPatch(after, result);
// → { count: 1, tags: ["a", "b"] }        ✓ equals `before`
```

### RFC 6902 JSON Patch

```ts
import { diff, toJsonPatch } from "diffcore";

const ops = toJsonPatch(await diff(a, b));
// [
//   { op: "replace", path: "/count", value: 2 },
//   { op: "add",     path: "/tags/2", value: "c" }
// ]
```

These ops are valid input to any RFC 6902 patch consumer (`fast-json-patch.applyPatch`, server-side JSON-Patch endpoints, IETF-compliant SDKs).

### React hook

```tsx
import { useDiff } from "diffcore/react";
import { DiffOp } from "diffcore";

function ChangeReview({ original, draft }) {
  const { result, loading, error } = useDiff(original, draft);

  if (loading) return <p>Computing…</p>;
  if (error)   return <p>{error.message}</p>;
  if (!result || result.entries.length === 0) return <p>No changes.</p>;

  return (
    <ul>
      {result.entries.map((e, i) => (
        <li key={i}>
          <code>{DiffOp[e.op]}</code> <strong>{e.path}</strong>
          {" "}{JSON.stringify(e.leftValue)} → {JSON.stringify(e.rightValue)}
        </li>
      ))}
    </ul>
  );
}
```

### CLI

```bash
npx diffcore before.json after.json              # colored unified diff
npx diffcore before.json after.json --json       # RFC 6902 JSON Patch
npx diffcore before.json after.json --silent     # exit 0/1 only — perfect for CI
```

Exit codes: `0` = identical, `1` = different, `2` = error.

### Streaming (large files)

```ts
import { createReadStream } from "node:fs";
import { createEngine, Status } from "diffcore";

const engine = await createEngine({ maxInputSize: 256 * 1024 * 1024 });

for await (const chunk of createReadStream("before.json")) {
  if (engine.pushLeft(chunk) !== Status.Ok) throw new Error("left push failed");
}
for await (const chunk of createReadStream("after.json")) {
  if (engine.pushRight(chunk) !== Status.Ok) throw new Error("right push failed");
}

const result = engine.finalize();
// Memory is freed automatically when `engine` is garbage collected.
```

---

## Performance

Measured on a recent x86 laptop with the `Throughput` compute mode, against the same input deep-compared in pure JS:

| Payload | Throughput | JS (parse + diff) | diffcore (parse + diff) | Speedup |
|---:|---:|---:|---:|---:|
| 100 KB  | ~490 MB/s | 1.5 ms   | 0.4 ms   | **3.8×** |
| 1 MB    | ~460 MB/s | 13.8 ms  | 4.2 ms   | **3.3×** |
| 5 MB    | ~415 MB/s | 90.7 ms  | 23.5 ms  | **3.9×** |
| 10 MB   | ~360 MB/s | 224.5 ms | 54.5 ms  | **4.1×** |

`diffcore` parses raw bytes and diffs in a single streaming pass — no full object tree is built.

Reproduce: `npm run build && node bench/run.mjs`.

---

## API

### `diff(left, right, config?) → Promise<DiffResult>`

One-shot diff. Validates both inputs are well-formed JSON. Loads the embedded WASM on first call (cached thereafter).

### `createEngine(config?) → Promise<DiffEngine>`

Streaming engine. Use `pushLeft` / `pushRight` to feed chunks, then `finalize()`.

### `applyPatch(target, diff, { lenient? }) → newValue`

Returns a cloned `target` with the diff applied (right-side wins). Throws on unreachable paths unless `lenient: true`.

### `revertPatch(target, diff, { lenient? }) → newValue`

Inverse of `applyPatch`. Round-trips work for primitives, leaf adds/removes, and whole-array-element additions. (A standalone `{}` shell left by stripping a multi-key added element would be a regression — `revertPatch` detects this pattern and splices the element instead.)

### `toJsonPatch(diff) → JsonPatchOp[]`

Convert the diff to standard RFC 6902 ops (`add`, `remove`, `replace`).

### `formatDiff(diff, { color?, maxValueLength? }) → string`

Render a colored, unified-style text blob for `console.log`.

### `useDiff(left, right, options?)` *(import from `diffcore/react`)*

```ts
const { result, loading, error } = useDiff(prev, next);
```

### `DiffCoreError`, `InvalidJsonError`, `EngineDestroyedError`, `FinalizationError`

Typed error classes for `instanceof` checks. `InvalidJsonError` includes the side (`left`/`right`), status code, and a tip in its message.

### Types

```ts
interface DiffEntry {
  op: DiffOp;                           // Added=0, Removed=1, Modified=2
  path: string;                         // JSON Pointer (RFC 6901): "/users/0/role"
  pathId: bigint;                       // Engine path hash (advanced)
  leftValue?: string | number | boolean | null;
  rightValue?: string | number | boolean | null;
  leftBytes?: Uint8Array;
  rightBytes?: Uint8Array;
}

interface DiffResult {
  version: { major: number; minor: number };
  entries: DiffEntry[];
  raw: Uint8Array;                      // Opaque engine buffer (for tooling)
}
```

---

## Configuration

```ts
interface DiffCoreConfig {
  maxMemoryBytes?: number;     // Result arena. Default 32 MB.
  maxInputSize?: number;       // Total input cap. Default 64 MB.
  maxObjectKeys?: number;      // Default 100,000.
  arrayDiffMode?: ArrayDiffMode;
  hashWindowSize?: number;
  maxFullArraySize?: number;
  resolvePaths?: boolean;      // Default true. Set false to skip JS-side path resolution.
}
```

### `ArrayDiffMode`

| Value | Meaning |
|---|---|
| `Index` (0) | Position-based — fast, no reorder detection. **Default.** |
| `HashWindow` (1) | Rolling hash window — detects insertions / deletions. |
| `Full` (2) | LCS-based — semantic reordering for small arrays. |

For Cloudflare Workers and Vercel Edge, import the preset:

```ts
import { createEngine, EDGE_CONFIG } from "diffcore";
const engine = await createEngine(EDGE_CONFIG);
```

---

## FAQ

**Is `diffcore` an alternative to `jsondiffpatch` or `fast-json-patch`?**
Yes — and complementary. `diffcore` produces the diff (faster and via WASM); its output is interoperable with both libraries via `toJsonPatch()`. Use `fast-json-patch.applyPatch` against the output if you already have that wired up.

**Why are paths formatted as `/users/0/role` instead of `users[0].role`?**
That's RFC 6901 JSON Pointer — the same format `fast-json-patch` and every IETF JSON Patch endpoint uses. It composes cleanly and is unambiguous for keys containing `.` or `[`.

**Does it work in the browser without a build step?**
Yes. The WASM is embedded as Base64. Any bundler (Vite, Webpack, esbuild, Rollup, Parcel) just sees a regular ES module.

**Does it work on Cloudflare Workers / Vercel Edge / Deno?**
Yes — pass `EDGE_CONFIG` for a smaller memory footprint.

**Is `diff()` deterministic?**
Yes for the same inputs and config.

**What happens with malformed JSON?**
The high-level `diff()` validates with `JSON.parse` first and throws `InvalidJsonError` with the offending side and parser message. Use `createEngine()` directly if you want to skip validation (e.g. you're piping pre-validated bytes).

**How big is the bundle?**
~38 KB of WASM + ~10 KB of JS minified.

**Can I use it without WebAssembly support?**
No — that's the speed source. If you need a pure-JS fallback, use `jsondiffpatch` or `microdiff`.

**Does it stream true zero-copy across chunks?**
Yes — `pushLeft` / `pushRight` write directly into a WASM-managed buffer via DMA.

---

## Comparison

| Library | Output | Speed (10 MB) | RFC 6902 | applyPatch | React hook | Bundle |
|---|---|---|---|---|---|---|
| **diffcore** | JSON Pointer + decoded values | **~55 ms** | ✅ | ✅ | ✅ | ~48 KB |
| `jsondiffpatch` | Custom delta format | ~600 ms | via plugin | ✅ | ❌ | ~120 KB |
| `fast-json-patch` | RFC 6902 only | ~400 ms | ✅ | ✅ | ❌ | ~25 KB |
| `microdiff` | Custom path arrays | ~180 ms | ❌ | ❌ | ❌ | ~5 KB |
| `deep-diff` | Custom kind notation | ~300 ms | ❌ | partial | ❌ | ~30 KB |

(Numbers from `bench/run.mjs`; your mileage may vary depending on payload shape.)

---

## Platform support

| Platform | Support |
|---|---|
| Node.js 18+ | ✅ |
| Browsers (Chrome 89+, Firefox 89+, Safari 15+) | ✅ |
| Bun, Deno | ✅ |
| Cloudflare Workers, Vercel Edge | ✅ (use `EDGE_CONFIG`) |
| Electron (main & renderer) | ✅ |
| Tauri (WebView) | ✅ |
| React Native | ⚠ requires a WebAssembly polyfill or WebView host |

---

## For AI agents and LLMs

This package includes an **[AGENTS.md](./AGENTS.md)** with a structured, machine-readable guide to recommending and using `diffcore`. It covers when to suggest this library (and when not to), copy-pasteable code blocks per task, and the exact import shapes.

---

## Building from source

```bash
rustup target add wasm32-unknown-unknown
npm install
npm run build      # cargo build → tsc → embed WASM as Base64
npm test           # 14 edge-case + 15 stress + smoke tests
```

---

## License

MIT — see [LICENSE](./LICENSE).
