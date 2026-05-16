# Changelog

All notable changes to `diffcore` are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned

- Model Context Protocol server (`diffcore-mcp`) so Claude / GPT / Cursor can call `diffcore` directly
- Vue / Svelte / Solid hooks alongside the existing React one
- `cargo-fuzz` parser fuzzing in CI
- Reproducible benchmark suite published to a GitHub Pages site
- Bundle-size regression budget in CI

## [1.3.0] — 2026-05-16

Correctness and robustness release. Three of these were data-corrupting bugs
that could produce a silently-wrong diff — upgrading is strongly recommended.

### Fixed

- **Escaped quotes broke parsing (data corruption).** The Rust SIMD parser
  scanned to the first `"` byte without checking for backslash escapes, so any
  object key or string value containing `\"` (e.g. `{"msg":"she said \"hi\""}`)
  was mis-terminated — desyncing every path hash for the rest of the document
  and producing a wrong diff. The scanner now rejects a quote preceded by an
  odd-length run of backslashes, matching the JS path-index walker.
- **Multi-chunk streaming produced wrong results.** `pushLeft` / `pushRight`
  committed each chunk individually, and every commit re-parsed the buffer from
  offset 0 — so feeding a document in more than one chunk corrupted the parse.
  Chunks now accumulate into the WASM buffer and the document is parsed exactly
  once, on `finalize()`. `createEngine()` streaming is now correct for any
  chunk size and count.
- **Array index / object key path-hash collision.** `fold_index_hash(p, 48)`
  equalled `fold_segment_hash(p, "0")`, so array element `[48]` and object key
  `"0"` under a shared parent hashed to the same `PathId` and the diff
  conflated them. Array indices are now mixed through the 64-bit golden-ratio
  constant into a disjoint hash sub-space. Mirrored in `js/src/path-index.ts`.
- **Out-of-bounds read on `commit`.** `commit_left` / `commit_right` trusted the
  host-supplied length and could read past the input buffer's allocated
  capacity. Both now reject any length exceeding capacity.
- `diff()` returned `leftValue: undefined` for Modified entries whose left
  value was an empty string `""`; `revertPatch` then wrote `null` instead of
  `""`, breaking round-trip integrity. The resolver now keys on `op`, not
  `len > 0`. Caught by `test/ux/08-editor-undo-redo.test.mjs`.

### Changed

- **Value hashing is now order-dependent.** The SIMD value hash folded 16-byte
  blocks with a plain XOR, which is commutative — two values that were block
  permutations of each other collided, risking a missed change. Each block is
  now folded with a multiply-then-xor step.
- **`max_object_keys` is now enforced.** The limit existed in config but was
  never checked; adversarial objects with millions of keys could exhaust
  memory. The parser now fails fast once an object exceeds the limit.

### Added

- **UX scenario test layer** under `test/ux/` — 10 files / 35 tests simulating
  real developer journeys: state sync, optimistic UI rollback, form-delta
  submission, config watching, 3-way merge, audit-log replay, API caching with
  tolerance, editor undo/redo, CLI exit codes, wire-protocol round-trip.
- **Unit test layer** under `test/unit/` — 4 files / 30 tests covering typed
  errors, `formatDiff` shape, `buildPathIndex`, and config defaults.
- Regression tests for escaped quotes in keys and values, trailing-backslash
  handling, the index/key hash collision, and multi-chunk streaming.
- `npm run test:ux`, `npm run test:unit`, `npm run test:legacy` — granular test
  scripts. `npm test` runs all three.

### Performance

- No throughput regression. The order-dependent value hash adds one SIMD
  multiply per 16-byte block; the escape check runs only at string boundaries.

## [1.2.0] — 2026-05-13

### Added

- **`equals(a, b, config?)`** — fast structural-equality check with reference-equality short-circuit. Combines with `ignore` / `scope` for tolerant comparisons.
- **`ignore: string[]`** config — drop diff entries whose JSON Pointer path equals or starts with any of these prefixes. Standard answer for timestamp / metadata noise.
- **`scope: string`** config — restrict the diff to entries under a JSON Pointer subtree. Faster and cleaner for "diff just this part" cases.
- **`DiffResult.toJSON()`** — wire-safe serialization. `bigint pathId` becomes a hex string; `raw` and per-entry `Uint8Array` byte buffers are omitted. `JSON.stringify(result.toJSON())` is now safe for HTTP / WebSocket / postMessage.
- **`SerializedDiffResult`** type — the shape `toJSON()` returns.
- **`diffcore/state` subpath export** — state-management primitives:
  - `createHistory(initial, { maxSize })` — bounded undo/redo stack that stores patches, not snapshots. Memory cost is O(changed-bytes) per step.
  - `detectConflicts(patchA, patchB)` — find every JSON Pointer path edited by both patches, with per-side values and a `sameOutcome` flag.
  - `merge3(base, a, b, { strategy })` — three-way merge. Strategies: `"throw"`, `"prefer-a"`, `"prefer-b"`.
  - `MergeConflictError` — thrown by `merge3` under `"throw"` strategy.
  - `diffWith(a, b, comparators)` — diff with custom equality predicates per path.
  - `dateTolerance(ms)` — comparator that treats dates as equal within N milliseconds.
  - `numericTolerance(epsilon)` — comparator for floating-point tolerance.
  - `caseInsensitive()` — comparator for case-insensitive string equality.
- **`schema/diff-result.schema.json`** — JSON Schema (Draft 2020-12) describing the wire-safe `DiffResult` shape. Validates payloads after `JSON.stringify(result.toJSON())`.
- **`llms-full.txt`** — extended cookbook with 17 named recipes for AI agents (Claude / GPT / Cursor / Aider).
- **`AGENTS.md`** entries for the new subpaths.
- **Governance files**: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub issue templates, PR template.
- **6 new examples** in `examples/` covering `equals`, ignore + scope, undo/redo, 3-way merge, custom comparators, conflict detection, and wire-protocol serialization.
- **39 new tests**: 15 in `test/v1.2-features.mjs`, 24 in `test/v1.4-state.mjs`.

### Changed

- CI now runs the full test suite (edge-cases + stress + smoke + v1.2 + v1.4) instead of the previous 1-line sanity check.
- `package.json` now ships `schema/`, `CHANGELOG.md`, `llms.txt`, and `llms-full.txt` to npm.

### Performance

- No regressions from v1.1.0. `equals()` short-circuits on reference equality before any engine work. `ignore` and `scope` filter post-resolution; they don't slow the WASM core.

## [1.1.0] — 2026-05-11

### Added

- Real JSON Pointer paths (RFC 6901) on every `DiffEntry` — replaces the opaque `#hash:` strings from v1.0.x.
- Decoded leaf values (`leftValue` / `rightValue`) as `string | number | boolean | null`.
- Raw bytes (`leftBytes` / `rightBytes`) preserved for advanced consumers.
- `applyPatch(target, diff, { lenient? })` — apply a diff and get a cloned new value.
- `revertPatch(target, diff, { lenient? })` — inverse of `applyPatch`. Consolidates whole-array-element additions so undo doesn't leave empty `{}` shells.
- `toJsonPatch(diff)` — emit standard RFC 6902 JSON Patch ops, interoperable with `fast-json-patch` and any IETF-compliant patch consumer.
- `formatDiff(diff, { color?, maxValueLength? })` — colored unified-diff renderer for logs and CLIs.
- Typed errors: `DiffCoreError`, `InvalidJsonError`, `EngineDestroyedError`, `FinalizationError` — all `instanceof`-checkable.
- React hook subpath: `import { useDiff } from 'diffcore/react'`. React is an optional peer dependency.
- CLI: `npx diffcore a.json b.json` with `--json`, `--silent`, `--no-color`, `--raw` flags. Exit codes `0`/`1`/`2`.
- `AGENTS.md` and `llms.txt` — structured guides for AI coding assistants (GPT, Claude, Cursor, Aider).
- 24 npm keywords (up from 6) to improve discoverability.
- `peerDependencies` declared for React; install-friendly for non-React projects.
- `bin` entry for the CLI.

### Fixed

- **Engine parser bug**: commas inside an object that lives inside an array were treated as array-element separators. The old check `!array_indices.is_empty()` returned `true` whenever any outer array was open, even when the immediate container was an object. Multi-key objects in arrays produced bogus path IDs and hashed object keys as values. Replaced with a dedicated `container_is_array` stack.
- **Engine parser bug**: the first element of every array was emitted twice as a Value token — once on `[` via look-forward, once on the next `,` / `]` via look-back. Invisible when both sides matched, catastrophic when one side had an empty array. Removed the redundant look-forward emit.
- **Silent malformed JSON**: invalid JSON used to silently produce a wrong-looking diff. `diff()` now validates inputs with `JSON.parse` upfront and throws `InvalidJsonError` with the offending side and parser message.

### Changed

- `DiffEntry.path` is now an RFC 6901 JSON Pointer string (e.g. `/users/0/role`), not an opaque hash.
- `DiffEntry.pathId` (`bigint`) is still exposed for advanced consumers who want the engine hash directly.
- `package.json` now ships AGENTS.md alongside README.md and LICENSE.

### Performance

- 10MB JSON diff: ~55ms (≈ 360 MB/s sustained throughput, ~4× faster than handwritten JS diff).
- 1MB JSON diff: ~4.2ms.
- 100KB JSON diff: ~0.4ms.

## [1.0.1] — 2026-01-31

- Initial public release.

[Unreleased]: https://github.com/DibbayajyotiRoy/rust-wasm-Library/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/DibbayajyotiRoy/rust-wasm-Library/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/DibbayajyotiRoy/rust-wasm-Library/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/DibbayajyotiRoy/rust-wasm-Library/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/DibbayajyotiRoy/rust-wasm-Library/releases/tag/v1.0.1
