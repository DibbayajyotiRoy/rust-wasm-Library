# DiffCore

High-performance streaming JSON diff engine powered by WebAssembly.

[![npm version](https://img.shields.io/npm/v/diffcore.svg)](https://www.npmjs.com/package/diffcore)
[![CI](https://github.com/DibbayajyotiRoy/rust-wasm-Library/actions/workflows/ci.yml/badge.svg)](https://github.com/DibbayajyotiRoy/rust-wasm-Library/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

| Feature | Description |
|---------|-------------|
| **🚀 Extreme Throughput** | 800+ MB/s on standard hardware, 5x faster than optimized JS |
| **📦 Zero Config** | WASM embedded as Base64, auto-loads with no external files |
| **🧹 Automatic Cleanup** | Memory managed via `FinalizationRegistry` – no `.destroy()` needed |
| **🌊 Streaming API** | Process multi-GB JSON through chunked DMA input |
| **⚡ SIMD Accelerated** | `v128` structural indexing and parallel value hashing |
| **🧵 Web Worker Ready** | Off-main-thread execution with zero-copy `Transferable` buffers |
| **🌍 Universal Runtime** | Works in Node.js 18+, browsers, Cloudflare Workers, Vercel Edge, Deno |

## Installation

```bash
npm install diffcore
```

## Quick Start

### One-Shot Diff (Simplest)

```typescript
import { diff } from 'diffcore';

const result = await diff(
  '{"users": [{"name": "Alice"}]}',
  '{"users": [{"name": "Bob"}]}'
);

for (const entry of result.entries) {
  console.log(`${entry.op}: ${entry.path}`);
}
// Output: Modified: $.users[0].name
```

### Streaming Engine (Large Files)

```typescript
import { createEngine, Status } from 'diffcore';

const engine = await createEngine({
  maxInputSize: 128 * 1024 * 1024, // 128MB
  arrayDiffMode: 1, // HashWindow
});

// Stream chunks directly
for await (const chunk of leftStream) {
  engine.pushLeft(chunk);
}
for await (const chunk of rightStream) {
  engine.pushRight(chunk);
}

const result = engine.finalize();
// No destroy() needed - automatic cleanup via FinalizationRegistry
```

## Performance

| Payload | Throughput | JS (total) | DiffCore | Speedup |
|---------|------------|------------|----------|---------|
| 100KB   | 750 MB/s   | 1.1ms      | 0.3ms    | **4.1x** |
| 1MB     | 635 MB/s   | 11.9ms     | 3.1ms    | **3.9x** |
| 5MB     | 602 MB/s   | 60.6ms     | 16.2ms   | **3.7x** |
| 10MB    | 464 MB/s   | 126.5ms    | 42.1ms   | **3.0x** |

*JS (total) = `JSON.parse` + diff. DiffCore parses and diffs in a single streaming pass.*

## API Reference

### `diff(left, right, config?)`

One-shot convenience function for diffing two JSON documents.

```typescript
const result = await diff(leftJson, rightJson);
console.log(result.entries);
```

### `createEngine(config?)`

Create a streaming engine instance for chunked processing.

```typescript
const engine = await createEngine();
engine.pushLeft(chunk);
engine.pushRight(chunk);
const result = engine.finalize();
```

### `createEngineWithWasm(wasmSource, config?)`

Advanced: load WASM from a custom source (CDN, custom build).

```typescript
const engine = await createEngineWithWasm(
  'https://cdn.example.com/diffcore.wasm',
  { maxInputSize: 256 * 1024 * 1024 }
);
```

### `DiffCoreWorker` (Web Worker)

Off-main-thread execution with zero-copy Transferable buffers.

```typescript
import { DiffCoreWorker } from 'diffcore/worker';

const worker = new DiffCoreWorker('./diffcore-worker.js');
await worker.init(wasmBytes, config);

await worker.pushLeft(leftBuffer);  // Transferred, not copied
await worker.pushRight(rightBuffer);

const result = await worker.finalize();
await worker.destroy();
```

## Configuration

```typescript
interface DiffCoreConfig {
  /** Max memory for result arena. Default: 32MB */
  maxMemoryBytes?: number;
  
  /** Max total input size. Default: 64MB */
  maxInputSize?: number;
  
  /** Max object keys to buffer. Default: 100,000 */
  maxObjectKeys?: number;
  
  /** Array diff strategy. Default: Index (0) */
  arrayDiffMode?: ArrayDiffMode;
  
  /** Hash window size for HashWindow mode. Default: 64 */
  hashWindowSize?: number;
  
  /** Max array size for Full mode LCS. Default: 1024 */
  maxFullArraySize?: number;
}
```

### Array Diff Modes

| Mode | Value | Description |
|------|-------|-------------|
| **Index** | 0 | Position-based only. Fast, no reorder detection. |
| **HashWindow** | 1 | Rolling hash window. Detects insertions/deletions. |
| **Full** | 2 | Full LCS buffer. Semantic reordering, small arrays only. |

### Pre-configured for Edge Runtimes

```typescript
import { createEngine, EDGE_CONFIG } from 'diffcore';

const engine = await createEngine(EDGE_CONFIG);
// Optimized for Cloudflare Workers, Vercel Edge, etc.
```

## Result Structure

```typescript
interface DiffResult {
  version: { major: number; minor: number };
  entries: DiffEntry[];
  raw: Uint8Array; // Raw binary result for advanced processing
}

interface DiffEntry {
  op: DiffOp;        // Added=0, Removed=1, Modified=2
  path: string;      // JSON path like $.users[0].name
  leftValue?: Uint8Array;
  rightValue?: Uint8Array;
}
```

## Status Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | `Ok` | Operation successful |
| 1 | `NeedFlush` | Buffer full, flush before continuing |
| 2 | `InputLimitExceeded` | Data exceeds `maxInputSize` |
| 3 | `EngineSealed` | Cannot push after `finalize()` |
| 4 | `InvalidHandle` | Engine corrupted or destroyed |
| 5 | `ObjectKeyLimitExceeded` | Too many unique keys |
| 6 | `ArrayTooLarge` | Array exceeds `maxFullArraySize` for Full mode |
| 255 | `Error` | Generic processing error |

## Advanced Usage

### Explicit Memory Management

While automatic cleanup is the default, you can destroy immediately:

```typescript
const engine = await createEngine();
try {
  // ... use engine
} finally {
  engine.destroy(); // Immediate cleanup
}
```

### Check Engine Status

```typescript
const engine = await createEngine();
console.log(engine.isDestroyed); // false
engine.destroy();
console.log(engine.isDestroyed); // true
```

### Error Handling

```typescript
const error = engine.getLastError();
if (error) {
  console.error('Engine error:', error);
}
```

## Building from Source

```bash
# Prerequisites: Rust, wasm-pack
rustup target add wasm32-unknown-unknown

# Build everything
npm run build

# Individual steps
npm run build:wasm    # Compile Rust to WASM
npm run build:js      # Compile TypeScript
npm run build:bundle  # Embed WASM as Base64
```

## Browser Compatibility

| Platform | Minimum Version |
|----------|-----------------|
| Chrome | 89+ |
| Firefox | 89+ |
| Safari | 15+ |
| Node.js | 18+ |
| Cloudflare Workers | ✓ |
| Vercel Edge | ✓ |
| Deno | ✓ |

## License

MIT
