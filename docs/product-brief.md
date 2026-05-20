# diffcore — Product Brief (for pitches, posts, and outreach)

> **What this file is.** A source-of-truth selling kit for diffcore. Newsletter editors,
> Reddit threads, HN posts, podcast intros, sponsor pages, dev.to articles — anywhere
> you need to introduce the project, pull copy from here. Mix-and-match the building
> blocks. **Do not paste any section verbatim** to AI-moderated forums; rewrite in
> your own voice. (See [`newsletter-pitch-outlines.md`](./newsletter-pitch-outlines.md)
> for the channel-specific outreach plan.)
>
> Last updated: 2026-05-20 · diffcore v1.3.0

---

## 1. The one-liner (pick one)

Use the shortest version that fits the slot. Each is independently true and load-bearing.

- **8 words:** WebAssembly JSON diff with apply, revert, merge.
- **15 words:** A 38 KB WASM JSON diff engine that emits RFC 6902 patches and ships undo/redo.
- **One sentence:** diffcore is a fast WebAssembly JSON diff library that returns real JSON Pointer paths, emits standard RFC 6902 patches, and ships the apply / revert / three-way-merge primitives most diff libraries leave for you to build.
- **Tweet:** Diff two JSON docs → get RFC 6902 patches, apply them, revert them, three-way-merge them. 38 KB of WASM, 3–4× faster than JS. `npm i diffcore`.

---

## 2. The problem (frame the pain first)

Almost every product that touches JSON state eventually needs to answer one of these questions:

- "What changed between these two documents?"
- "Apply this change. Now undo it."
- "Two users edited the same doc. Merge them."
- "Did anything *meaningful* change, ignoring timestamps?"
- "Send only the delta over the wire."

In the JS ecosystem, the existing answers each break in a different place:

| What devs reach for | Where it breaks |
|---|---|
| `jsondiffpatch` | Custom delta format, not RFC 6902. Slow on large docs. No three-way merge. |
| `fast-json-patch` | Great at *applying* patches; weak at *generating* them. No undo stack. |
| `microdiff` | Tiny and fast, but emits custom path arrays and gives you nothing else — no apply, no patch standard, no merge. |
| `deep-diff` | Custom `kind` notation that doesn't compose with anything else. |
| Hand-rolling | You eventually rewrite half of this anyway, badly, on a Friday afternoon. |

**The wedge:** there isn't a single library that gives you (1) WASM-class speed, (2) standard RFC 6902 output, (3) apply + revert + three-way merge, (4) a React hook, (5) a CLI, and (6) a 38 KB bundle. diffcore is that library.

---

## 3. The product, in one screen

```ts
import { diff, applyPatch, revertPatch, toJsonPatch } from "diffcore";
import { createHistory, merge3 } from "diffcore/state";
import { useDiff } from "diffcore/react";

// 1. What changed?
const result = await diff(before, after);
// → entries with RFC 6901 JSON Pointer paths + decoded values

// 2. Apply / revert
const next = applyPatch(before, result);
const prev = revertPatch(after, result);

// 3. Interop
const ops = toJsonPatch(result);            // standard RFC 6902, works with any consumer

// 4. State primitives
const history = createHistory(initial, { maxSize: 100 });
const merged  = await merge3(base, branchA, branchB);

// 5. React
const { result } = useDiff(prev, next);
```

The whole point: **one import, end-to-end coverage of the JSON-changed-what-now problem.**

---

## 4. Proof points (the receipts)

Every number here is reproducible. Lead with these in any pitch.

| Claim | Number | Source |
|---|---|---|
| Bundle size | **38 KB** WASM + ~10 KB JS, both minified | `dist/` after `npm run build` |
| Speed (10 MB JSON) | **~55 ms** parse + diff in a single pass | `bench/run.mjs` |
| Throughput | **350–500 MB/s** sustained | `bench/run.mjs` |
| Speedup vs JS | **3–4×** vs handwritten JS deep-diff | `bench/run.mjs` |
| Tests | **165+** across legacy, UX-scenario, and unit suites | `npm test` |
| Standards | **RFC 6901** paths, **RFC 6902** patches | Both literal IETF compliance |
| Platforms | Node 18+, Chrome/FF/Safari, Bun, Deno, CF Workers, Vercel Edge, Electron, Tauri | Manually verified each |
| Dependencies | **Zero** runtime deps | `package.json` |
| License | **MIT** | `LICENSE` |

**Reproduce any of these:** `npm run build && node bench/run.mjs`.

---

## 5. Who it's for (audience → value prop)

When pitching to a specific community, lead with the row that matches them.

| Audience | What they're building | Value-prop in their language |
|---|---|---|
| **State-sync / collab editing** | Multiplayer docs, optimistic UI, CRDT-adjacent flows | RFC 6902 patches over the wire + three-way merge + typed conflict reporting, in one library. |
| **Editor / form builders** | Rich-text editors, form wizards, design-tool history | Patch-based undo/redo stack with O(changed-bytes) memory — bounded forever, regardless of edit count. |
| **Backend / API engineers** | JSON Patch over HTTP, audit logs, replay systems | Generates standards-compliant RFC 6902 ops, parses 10 MB docs in ~55 ms, runs on Cloudflare Workers and Vercel Edge. |
| **CLI / DevOps / CI** | Config-drift detection, diff-in-CI fail gates | `npx diffcore a.json b.json --silent` → exit 0/1/2. Zero install lag (it's WASM + JS, no native build). |
| **React app developers** | Review-changes UIs, "what's changed" panels | First-class `useDiff(prev, next)` hook. Tree-shakeable subpath export. |
| **AI agent / LLM infra** | Diffing model JSON outputs, RAG state, structured eval | Stable RFC 6901 paths to feed an LLM. Ships `AGENTS.md` and `llms-full.txt` so coding assistants generate correct calls on the first try. |

---

## 6. Differentiators (what makes it interesting, not just useful)

Three of these are good enough that an editor will feature the post around them. Pick **one** per pitch — don't list all six.

### A. WASM speed with a JS-first API

3–4× faster than optimized JS without asking you to think about WebAssembly. The
WASM is embedded as Base64; every bundler imports it as a plain ES module. No
build step, no toolchain, no Vite plugin, no `?init` import suffix.

### B. The state-management primitives nobody else ships

Most JSON diff libraries stop at "here's what changed." diffcore keeps going:

- `createHistory(initial)` — bounded patch-based undo/redo
- `merge3(base, a, b)` — three-way merge with `"throw" | "prefer-a" | "prefer-b"`
- `detectConflicts(patchA, patchB)` — "who would step on whom?"
- `diffWith(a, b, comparators)` — per-path tolerance (dates within N ms, numbers within ε)

These compose. You can `diff` → `applyPatch` → push into `createHistory` → `merge3`
two branches → serialize via `toJSON()` → ship to a server — without leaving the package.

### C. Standards-first output

`/users/0/role`, not `users[0].role`. JSON Pointer (RFC 6901) paths and JSON Patch
(RFC 6902) ops are what `fast-json-patch`, IETF servers, and every standards-respecting
patch consumer already speak. Drop diffcore in next to existing tooling — no glue layer.

### D. AI-agent-ready documentation

`AGENTS.md` + `llms-full.txt` ship in the package. They give Claude / GPT / Cursor / Aider
the exact import shape, the canonical recipe per task, and the common pitfalls.
Generated code from these models works on the first try. (This angle alone is a post —
"making your OSS library legible to coding assistants.")

### E. The v1.3 bug post-mortems (newsletter editors *love* these)

v1.3.0 fixed four genuine data-corruption bugs. Any one of them is a publishable
short essay; together they make a great "lessons from shipping a SIMD parser" piece:

1. **Escaped-quote parser bug.** The Rust SIMD scanner found the first `"` byte
   without checking for backslash escapes — so `{"msg":"she said \"hi\""}` mis-terminated
   the key, desyncing every path hash for the rest of the document. The diff still
   "succeeded" — it was just silently wrong.
2. **Multi-chunk streaming.** Each `pushLeft` / `pushRight` re-parsed the buffer from
   offset 0, so streaming a doc in N chunks gave you N times the parse work and a
   corrupt result. Fix: chunks accumulate, document parses exactly once on `finalize()`.
3. **Hash collision between array indices and `"0"`-style keys.** `fold_index_hash(p, 48)`
   collided with `fold_segment_hash(p, "0")`, so element `[48]` and key `"0"` under
   a shared parent hashed identically — the diff conflated them.
4. **OOB read on commit.** `commit_left` / `commit_right` trusted host-supplied lengths
   and could read past the input buffer's allocated capacity.

The narrative: "fast and wrong is worse than slow and right; here's how we found these."

### F. 38 KB at the edge

The whole engine fits in a single edge-worker page. `EDGE_CONFIG` preset for
Cloudflare Workers / Vercel Edge with a tuned memory footprint.

---

## 7. Anti-claims (what diffcore is NOT — say this out loud)

Pitches read more credible when they self-disqualify. Pick one to include if the audience would otherwise wonder.

- **Not a CRDT.** No automatic concurrent-edit resolution beyond three-way merge. If you need OT/CRDT, use Yjs or Automerge — and use diffcore alongside it for snapshot diffs.
- **Not a generic deep-equal.** It's biased toward JSON-shaped data: strings, numbers, booleans, null, arrays, objects. No Date / Map / Set / class semantics — call `JSON.stringify` first if that's what you have.
- **Not a pure-JS library.** It needs WebAssembly. React Native requires a polyfill or WebView host.
- **Not a binary diff.** It diffs JSON documents, not arbitrary blobs.

---

## 8. The narratives (pick the one that fits the venue)

Each is a post angle. The body of any pitch should pick **one** of these and commit to it.

### Narrative 1 — "The JSON diff library that ships the stuff you'd otherwise write yourself."
**Best for:** JavaScript Weekly, Bytes.dev, Reddit r/javascript, dev.to.
**Hook:** Lists everything you stop writing the day you install it (undo stack, three-way merge, RFC 6902 emitter, React hook).

### Narrative 2 — "What I learned shipping a SIMD JSON parser in Rust to WASM."
**Best for:** This Week in Rust, Hacker News, Lobste.rs.
**Hook:** The four v1.3.0 bug post-mortems. Engineering story, not a product pitch — the product is the case study.

### Narrative 3 — "Making your OSS library legible to AI coding assistants."
**Best for:** dev.to, Hashnode, AI/ML-adjacent newsletters, Console.dev.
**Hook:** `AGENTS.md` + `llms-full.txt` as a pattern. diffcore is the worked example.

### Narrative 4 — "Standards-first JSON tooling: stop inventing your own delta format."
**Best for:** API-platform / backend-leaning newsletters, IETF-adjacent crowds.
**Hook:** RFC 6901 + RFC 6902 + interop with `fast-json-patch` and any IETF-compliant server.

### Narrative 5 — "3-4× faster JSON diffs with zero config."
**Best for:** Performance-focused threads, big-payload-shipping audiences.
**Hook:** Single linear pass over UTF-8 bytes, no intermediate object tree, embedded WASM.

---

## 9. Objection handling

The five questions you'll get asked. Pre-answer them.

| Objection | Response |
|---|---|
| *"Yet another JSON diff library?"* | Yes — and it's the first one that bundles diff + apply + revert + three-way merge + RFC 6902 + React hook + CLI under 48 KB total. The comparison table in the README makes the case row by row. |
| *"Is the WASM safe to embed?"* | 100% of the engine is in-tree Rust. No upstream binary dependencies. Build it yourself with `cargo build --release --target wasm32-unknown-unknown`. |
| *"What about React Native / older Safari?"* | WASM is required. RN works with a polyfill or WebView host. Safari 15+ is fine. There's no pure-JS fallback by design — that's what `microdiff` is for, and we say so. |
| *"How is this different from `fast-json-patch`?"* | `fast-json-patch` is great at *applying* patches and weak at *generating* them. diffcore generates; you can keep applying with `fast-json-patch` if you prefer. There's a [full head-to-head](./vs/diffcore-vs-fast-json-patch.md). |
| *"Solo maintainer? Bus factor?"* | MIT, ~165 tests, reproducible benchmarks, zero runtime deps. Forkable in an afternoon. |

---

## 10. Copy fragments (mix-and-match building blocks)

Drop these into pitches, never as the whole pitch.

### Opener fragments

- "We kept reaching for a JSON diff library and bouncing off four of them — so we wrote diffcore."
- "Most JSON diff libraries stop at `here's what changed`. diffcore keeps going: apply, revert, three-way merge, undo stack, React hook."
- "38 KB of WebAssembly that diffs 10 MB of JSON in 55 ms and gives you RFC 6902 patches you can hand to any IETF-compliant server."

### Bridge / middle fragments

- "Returns RFC 6901 JSON Pointer paths and decoded values — not opaque hashes you have to slice yourself."
- "The state primitives (`createHistory`, `merge3`, `detectConflicts`) are tree-shakeable subpath exports — pay for what you use."
- "v1.3.0 fixed four genuine data-corruption bugs in the SIMD parser; the post-mortems are in the changelog."

### Closer fragments

- "Zero runtime deps, MIT, ships from `npm install diffcore`."
- "Runs on Node, browsers, Bun, Deno, Cloudflare Workers, Vercel Edge, Electron, and Tauri."
- "No need to feature it — just sharing in case it's useful." *(low-pressure closer for cold pitches)*

---

## 11. Headlines that have worked in dev-newsletter slots historically

Use these as templates, not verbatim. Edit so it sounds like you.

- "diffcore — JSON diff in WebAssembly with built-in undo/redo and three-way merge"
- "A 38 KB WASM JSON diff engine that emits standard RFC 6902 patches"
- "diffcore 1.3 — JSON diff with apply/revert, three-way merge, and a React hook"
- "Found a SIMD parser bug that silently corrupted every JSON diff with `\"` in it"
- "Making your OSS library AI-agent-friendly: a worked example"

---

## 12. The single most important sentence in any pitch

> **"Returns real JSON Pointer paths and ships apply / revert / three-way-merge alongside the diff — so you stop writing those yourself."**

Every pitch is a remix of this sentence. If a draft doesn't get this point across in the first 25 words, rewrite it.

---

## 13. Where to point readers

| Surface | URL |
|---|---|
| npm | `https://www.npmjs.com/package/diffcore` |
| GitHub | `https://github.com/DibbayajyotiRoy/rust-wasm-Library` |
| Changelog | `CHANGELOG.md` in the repo |
| API reference | `API.md` in the repo |
| Head-to-head comparisons | `docs/vs/` in the repo |
| AI-agent guide | `AGENTS.md` in the repo |

Single canonical link to lead with in pitches: **the GitHub repo**. npm is the proof-of-shipped, but the GitHub URL is what editors click first.

---

## 14. What to update before each pitch

A 30-second sanity check before sending:

- [ ] Is the version number current? (Check `package.json`.)
- [ ] Are the npm download numbers fresh? (`https://api.npmjs.org/downloads/point/last-week/diffcore`)
- [ ] Star count current? (Useful if it crosses a milestone — 100, 250, 500, 1k.)
- [ ] Is there a new bug post-mortem or release worth leading with?
- [ ] Have you read the venue's last 2 issues? (Voice-match.)

---

*Keep this brief tight. If a section grows past 1 screen, split it into a dedicated file. The point of the brief is that everything you need to write a pitch in 5 minutes is here.*
