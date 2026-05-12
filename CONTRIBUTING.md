# Contributing to diffcore

Thanks for being here. `diffcore` is a small project; PRs and issues are welcome.

## Quick links

- **Repo**: https://github.com/DibbayajyotiRoy/rust-wasm-Library
- **npm**: https://www.npmjs.com/package/diffcore
- **Issues**: https://github.com/DibbayajyotiRoy/rust-wasm-Library/issues

## Reporting a bug

Please open an issue with:

1. A minimal reproduction — ideally two JSON strings small enough to paste into the issue.
2. What you got, what you expected.
3. The version of `diffcore`, your Node.js / Bun / Deno version, and the runtime (Node, browser, Edge, Worker, …).

The smaller the reproduction, the faster the fix.

## Suggesting a feature

Open an issue first. Describe the use case in plain words ("I have X, I want to do Y") before proposing an API. Most diff-related features have subtle tradeoffs (especially anything touching arrays).

## Submitting a pull request

### Prerequisites

```bash
rustup target add wasm32-unknown-unknown   # for the Rust core
node >= 18
```

### Build

```bash
npm install
npm run build      # cargo build → tsc → embed WASM as Base64
npm test           # runs test/edge-cases.mjs + test/stress.mjs + test/smoke.mjs
```

### Code organization

- `src/` — Rust engine (compiled to `wasm32-unknown-unknown`)
- `js/src/` — TypeScript wrapper, React hook, CLI, formatters
- `dist/` — build output (do not edit by hand)
- `test/` — Node test suite
- `examples/` — runnable usage examples
- `docs_ui/` — landing page (Next.js)
- `bench/` — performance benchmark

### What we look for in a PR

- **Tests for new behavior.** Add cases to `test/edge-cases.mjs` (correctness) or `test/stress.mjs` (large/pathological inputs).
- **No regressions on existing tests.** Run `npm test` before pushing.
- **Performance awareness.** If your change touches the parser or diff core, run `node bench/run.mjs` and include before/after numbers in the PR.
- **TypeScript types stay tight.** No `any` unless absolutely necessary; prefer `unknown` and narrow.
- **Public API changes need a CHANGELOG entry.** Add it under `[Unreleased]`.

### Commit message style

Loosely [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: ...` — new public-facing capability
- `fix: ...` — bug fix
- `perf: ...` — performance improvement
- `docs: ...` — documentation only
- `test: ...` — test additions or fixes
- `refactor: ...` — non-functional internal change
- `chore: ...` — tooling / CI / build

### Anything Rust-side

If you change `src/*.rs`, you'll need to rebuild the WASM:

```bash
npm run build:wasm      # cargo + copy to pkg/
npm run build:bundle    # embed as Base64 into dist/wasm-embedded.js
```

Always include both steps in the same commit so reviewers can verify the binary matches the source.

## Areas where contributions are especially welcome

- **Fuzz testing** the parser with `cargo-fuzz` — `src/parser.rs` is the heart of the project and benefits from random-input fuzzing.
- **Vue / Svelte / Solid hooks** alongside the existing React one (the React hook in `js/src/react.ts` is a good template).
- **More `examples/`** — one well-explained example per real-world use case.
- **Comparison benchmark** vs `jsondiffpatch`, `fast-json-patch`, `microdiff`, `deep-diff` — with reproducible methodology.
- **Browser CI** — Playwright tests that exercise diffcore in real browser environments.

## Code of conduct

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing you agree that your contributions are licensed under the MIT License.
