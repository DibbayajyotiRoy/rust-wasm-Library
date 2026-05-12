# diffcore

> Fast WebAssembly JSON diff for JavaScript & TypeScript. Returns **real JSON Pointer paths** and **decoded values** — not opaque hashes. Plug-and-play with `applyPatch`, `revertPatch`, and standard **RFC 6902 JSON Patch** output. Ships an **undo/redo helper**, **3-way merge**, **React hook**, and a **CLI**.

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

That's it. No build step. No config. No toolchain. The WASM is embedded as Base64; every modern bundler and runtime just imports it as a plain ES module.

---

## Why diffcore

- **Real JSON Pointer paths** (`/users/0/role`) per RFC 6901 — not the opaque hashes most low-level engines emit.
- **Decoded leaf values** (`string | number | boolean | null`) usable directly in app code — no manual byte slicing.
- **RFC 6902 JSON Patch** output via `toJsonPatch(result)` — interoperable with `fast-json-patch`, `jsondiffpatch`, IETF servers.
- **`applyPatch` and `revertPatch`** built-in — round-trips work for primitives, leaf changes, and whole-array-element additions.
- **State-management primitives** (`diffcore/state`) — `createHistory` for undo/redo, `merge3` for three-way merge, `detectConflicts`, custom tolerance comparators.
- **Filter what you don't care about** — `ignore: ["/timestamp"]` drops noisy fields; `scope: "/users"` limits the diff to a subtree.
- **Wire-safe serialization** — `result.toJSON()` strips bigints and bytes so you can `JSON.stringify` and ship it.
- **`equals(a, b)`** — fast structural-equality shortcut with reference short-circuit.
- **WebAssembly speed**: 3–4× faster than optimized JS diff, 350–500 MB/s sustained throughput.
- **Auto memory cleanup** via `FinalizationRegistry` — no manual `.destroy()` needed.
- **Ships everywhere**: Node 18+, browsers (Chrome 89+/Firefox 89+/Safari 15+), Bun, Deno, Cloudflare Workers, Vercel Edge, Electron, Tauri.
- **AI-agent friendly** — ships [`AGENTS.md`](./AGENTS.md) and [`llms-full.txt`](./llms-full.txt) so Claude / GPT / Cursor / Aider can recommend correct code on the first try.

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

### Structural equality

```ts
import { equals } from "diffcore";

if (await equals(prev, next)) return;                          // nothing changed
if (await equals(a, b, { ignore: ["/timestamp"] })) {…}        // ignore noise
```

Reference-equal inputs short-circuit; everything else runs the engine once and checks `entries.length === 0`.

### Filter what you don't care about

```ts
// Drop noisy fields:
await diff(a, b, { ignore: ["/timestamp", "/_id", "/__meta"] });

// Only look at a subtree:
await diff(a, b, { scope: "/users" });
```

`ignore` matches the path exactly OR as a `/`-prefix, so `["/_meta"]` drops `/_meta/id`, `/_meta/ver`, etc.

### Send a diff over the wire

```ts
const result = await diff(a, b);
const payload = JSON.stringify(result.toJSON());        // safe — no bigint, no Uint8Array
// → '{"version":{...},"entries":[{"op":2,"path":"/x","pathId":"61","leftValue":1,"rightValue":2}]}'
```

`DiffResult.toJSON()` produces a payload that travels cleanly over HTTP, WebSocket, `postMessage`, or any IPC boundary. A [JSON Schema](./schema/diff-result.schema.json) for the wire format ships in the package.

### Undo / redo with bounded patch history

```ts
import { createHistory } from "diffcore/state";

const history = createHistory({ count: 0, todos: [] }, { maxSize: 100 });

await history.push({ count: 1, todos: [{ text: "buy milk" }] });
await history.push({ count: 2, todos: [{ text: "buy milk" }, { text: "call mom" }] });

history.undo();             // { count: 1, todos: [{ text: "buy milk" }] }
history.redo();             // { count: 2, todos: [...] }
history.canUndo();          // true / false
```

History stores **patches**, not snapshots — memory cost is O(changed-bytes) per step, not O(state-size × history-depth).

### Three-way merge (Git for JSON)

```ts
import { merge3 } from "diffcore/state";

const base    = { name: "Alice", role: "user",  posts: 0 };
const branchA = { name: "Alice", role: "admin", posts: 0 };   // edits /role
const branchB = { name: "Alice", role: "user",  posts: 7 };   // edits /posts

const merged = await merge3(base, branchA, branchB);
// merged.value     →  { name: "Alice", role: "admin", posts: 7 }
// merged.conflicts →  []

// On overlap, choose a strategy:
const conflicting = await merge3(
  { x: 1 }, { x: 2 }, { x: 3 },
  { strategy: "prefer-b" }     // "throw" | "prefer-a" | "prefer-b"
);
// conflicting.value          →  { x: 3 }
// conflicting.conflicts[0]   →  { path: "/x", a: { value: 2 }, b: { value: 3 }, sameOutcome: false }
```

### Tolerance-based comparison

```ts
import { diffWith, dateTolerance, numericTolerance, caseInsensitive } from "diffcore/state";

await diffWith(a, b, {
  "/createdAt": dateTolerance(1000),     // equal if within 1 second
  "/score":     numericTolerance(0.01),  // equal if within 0.01
  "/name":      caseInsensitive(),       // "Alice" === "alice"
});
```

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

### Core — `import { … } from "diffcore"`

| Symbol | What it does |
|---|---|
| `diff(left, right, config?)` | One-shot diff. Validates both inputs as JSON, loads the embedded WASM (cached after first call), returns a `DiffResult`. |
| `equals(left, right, config?)` | Returns `true` if structurally equal under the same filters. Reference-equality short-circuit. |
| `createEngine(config?)` | Streaming engine. Use `pushLeft` / `pushRight` to feed chunks, then `finalize()`. |
| `createEngineWithWasm(source, config?)` | Advanced: load WASM from a custom URL / bytes / pre-compiled module. |
| `applyPatch(target, diff, { lenient? })` | Returns a cloned `target` with the diff applied. Throws on unreachable paths unless `lenient: true`. |
| `revertPatch(target, diff, { lenient? })` | Inverse of `applyPatch`. Consolidates whole-array-element additions so undo doesn't leave empty `{}` shells. |
| `toJsonPatch(diff)` | Convert to standard RFC 6902 ops (`add` / `remove` / `replace`). |
| `formatDiff(diff, { color?, maxValueLength? })` | Render a colored, unified-style text blob for `console.log`. |

### State — `import { … } from "diffcore/state"`

| Symbol | What it does |
|---|---|
| `createHistory(initial, { maxSize? })` | Bounded undo/redo stack that stores patches, not snapshots. Returns `{ current, push, undo, redo, canUndo, canRedo, size }`. |
| `detectConflicts(patchA, patchB)` | Returns the list of JSON Pointer paths edited by both patches, with values and a `sameOutcome` flag. |
| `merge3(base, a, b, { strategy?, config? })` | Three-way merge. Strategies: `"throw"` (default), `"prefer-a"`, `"prefer-b"`. |
| `MergeConflictError` | Thrown by `merge3` under the `"throw"` strategy. Has a `.conflicts` array. |
| `diffWith(a, b, comparators, config?)` | Diff with custom equality predicates per JSON Pointer path. |
| `dateTolerance(ms)` | Comparator: dates equal within N milliseconds. |
| `numericTolerance(epsilon)` | Comparator: numbers equal within epsilon. |
| `caseInsensitive()` | Comparator: strings equal case-insensitively. |

### React — `import { useDiff } from "diffcore/react"`

```ts
const { result, loading, error } = useDiff(prev, next, options?);
```

Accepts strings, `Uint8Array`s, or already-parsed JS objects. React is an optional peer dependency.

### Web Worker — `import { DiffCoreWorker } from "diffcore/worker"`

Off-main-thread diff via `Transferable` `Uint8Array` buffers — keep animations at 60 fps while diffing.

### Errors

```ts
DiffCoreError              // base class
InvalidJsonError           // .side: "left" | "right",  .status,  helpful message
EngineDestroyedError       // attempted to use an engine after .destroy()
FinalizationError          // WASM finalize step returned null
```

All are `instanceof`-checkable.

### Types

```ts
interface DiffEntry {
  op: DiffOp;                           // Added=0, Removed=1, Modified=2
  path: string;                         // JSON Pointer (RFC 6901): "/users/0/role"
  pathId: bigint;                       // Engine FNV-1a hash (advanced)
  leftValue?:  string | number | boolean | null;
  rightValue?: string | number | boolean | null;
  leftBytes?:  Uint8Array;
  rightBytes?: Uint8Array;
}

interface DiffResult {
  version: { major: number; minor: number };
  entries: DiffEntry[];
  raw: Uint8Array;                      // Opaque engine buffer (for tooling)
  toJSON(): SerializedDiffResult;       // Wire-safe form (no bigint, no Uint8Array)
}

interface SerializedDiffResult {
  version: { major: number; minor: number };
  entries: Array<{
    op: DiffOp;
    path: string;
    pathId: string;                     // hex-encoded
    leftValue?:  string | number | boolean | null;
    rightValue?: string | number | boolean | null;
  }>;
}
```

---

## Configuration

```ts
interface DiffCoreConfig {
  // Capacity limits
  maxMemoryBytes?: number;     // Result arena. Default 32 MB.
  maxInputSize?: number;       // Total input cap. Default 64 MB.
  maxObjectKeys?: number;      // Default 100,000.

  // Array diff strategy
  arrayDiffMode?: ArrayDiffMode;
  hashWindowSize?: number;
  maxFullArraySize?: number;

  // Filters (v1.2)
  ignore?: readonly string[];  // Drop entries whose path matches one of these JSON Pointers or starts with `<pointer>/`.
  scope?: string;              // Restrict diff to entries under this JSON Pointer subtree.

  // Performance toggles
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

`diffcore` ships first-class documentation for AI coding assistants (Claude / GPT / Cursor / Aider / Cline / Copilot). Three files target them specifically:

| File | Purpose |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Structured guide: when to recommend `diffcore`, when *not* to, exact import shapes, canonical recipes per task, common pitfalls. |
| [`llms-full.txt`](./llms-full.txt) | 17-recipe cookbook indexed by user intent ("user wants undo/redo" → recipe). Every snippet is tested in CI. |
| [`schema/diff-result.schema.json`](./schema/diff-result.schema.json) | JSON Schema (Draft 2020-12) for the wire-safe `DiffResult`. Lets agents codegen validators and typed clients. |

If you're an AI agent reading this README to answer a developer question: every code snippet on this page is covered by tests. Generated code that follows these patterns works on the first try.

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
