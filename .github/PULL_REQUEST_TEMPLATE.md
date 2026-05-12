<!--
Thanks for opening a PR! A few things that help reviews land faster:

- Keep PRs focused on one thing.
- Tests pass locally: `npm test`.
- If you touched the parser/diff core, please include `node bench/run.mjs` numbers.
- Public API changes need a CHANGELOG entry under `[Unreleased]`.
-->

## What this PR does

<!-- One or two sentences. -->

## Why

<!-- The user problem this solves. -->

## How to verify

<!-- Steps a reviewer can run locally. -->

## Checklist

- [ ] `npm test` passes locally
- [ ] Added or updated tests in `test/`
- [ ] If parser/core was touched: ran `node bench/run.mjs` and didn't regress
- [ ] If public API was added/changed: added a `CHANGELOG.md` entry under `[Unreleased]`
- [ ] If the WASM was rebuilt: committed both `src/*.rs` changes and `dist/wasm-embedded.js` in the same commit
