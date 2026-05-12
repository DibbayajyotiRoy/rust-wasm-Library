# Security Policy

## Supported Versions

Only the latest minor version of `diffcore` receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.1.x   | ✅         |
| 1.0.x   | ❌ — please upgrade |
| < 1.0   | ❌         |

## Reporting a Vulnerability

If you believe you have found a security vulnerability in `diffcore`, please **do not open a public GitHub issue**.

Instead, report it privately via one of:

- GitHub's [private vulnerability reporting](https://github.com/DibbayajyotiRoy/rust-wasm-Library/security/advisories/new)
- Email the maintainer directly (address on the npm/GitHub profile)

Please include:

- A description of the vulnerability and its potential impact
- A minimal reproduction (ideally a small JSON pair or invocation)
- The version of `diffcore` affected
- Any mitigations you've identified

We aim to acknowledge reports within **72 hours** and to publish a patched release within **14 days** of triage for high-severity issues.

## Threat Model

`diffcore` runs inside the host JavaScript runtime (Node.js, browser, edge worker) and uses WebAssembly for the diff engine core. Things to be aware of:

- **The WASM module operates on raw bytes** passed in by the host. It will not exfiltrate data or make network calls.
- **Inputs are validated** by `JSON.parse` in the high-level `diff()` API before being passed to WASM. Power users using `createEngine()` opt out of this check.
- **The engine respects configured limits** (`maxMemoryBytes`, `maxInputSize`, `maxObjectKeys`, etc.) and returns explicit `Status` codes when limits are exceeded — it does not crash the host on pathological input.
- **There are no runtime dependencies.** The package ships only the WASM blob and a thin TypeScript wrapper.

## Hardening Recommendations for Consumers

If you process untrusted JSON with `diffcore`:

- Set explicit `maxInputSize`, `maxMemoryBytes`, and `maxObjectKeys` for your use case (defaults are conservative but generous).
- Treat any error thrown by `diff()` as a hard rejection of the input — don't retry with the same data.
- Consider running diff operations in a Web Worker or Node `worker_threads` so a malicious input cannot stall your main thread.

## Provenance

Each release is published with [npm provenance attestations](https://docs.npmjs.com/generating-provenance-statements). You can verify the published `diffcore` binary was built from this repository via:

```bash
npm audit signatures
```
