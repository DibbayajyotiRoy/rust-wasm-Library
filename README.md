# DiffCore: High-Performance Streaming JSON Diff Engine

DiffCore is a reference-quality WebAssembly compute engine designed for high-performance structural comparison of large JSON documents. It is optimized for memory-constrained environments like Cloudflare Workers, Edge runtimes, and high-throughput Node.js microservices.

## ✨ Key Features

- **🚀 Performance-First**: Trie-based path interning and CompactParser architecture achieve near-V8 speeds with constant memory overhead.
- **🌊 Streaming API**: Push JSON chunks in real-time as they arrive from the network; no need to buffer the entire file.
- **🛡️ Deterministic Safety**: Strict enforcement of capability limits (`max_object_keys`, `max_memory_bytes`). No Garbage Collection (GC) pauses.
- **🌍 Universal Library**: One `.wasm` binary for Browser, Node.js, and Edge.
- **🧬 Versioned Binary Protocol**: Output format includes a semantic versioned header (v1.0) for long-term compatibility.

## 📦 Installation

```bash
npm install diffcore
```

## 🚀 Quick Start (Node.js/TypeScript)

```typescript
import { DiffEngine, loadWasm } from 'diffcore';

async function run() {
  // 1. Load the WASM module
  const wasm = await loadWasm();

  // 2. Initialize the engine with custom limits (optional)
  const engine = new DiffEngine(wasm, {
    maxMemoryBytes: 32 * 1024 * 1024, // 32MB
    maxObjectKeys: 100_000
  });

  // 3. Stream data into the engine
  engine.pushLeft(Buffer.from('{"a": 1, "b": 2}'));
  engine.pushRight(Buffer.from('{"a": 1, "b": 3}'));

  // 4. Compute and retrieve diff
  const result = engine.finalize();

  console.log(`Found ${result.entries.length} changes:`);
  result.entries.forEach(e => {
    console.log(`${e.op} at ${e.path}: ${e.leftValue} -> ${e.rightValue}`);
  });

  // 5. Cleanup
  engine.destroy();
}
```

## 🧵 Off-Main-Thread (Web Worker)

For UI responsiveness, run DiffCore in a background thread using the provided Worker wrapper.

```typescript
import { DiffCoreWorker } from 'diffcore/worker';

const worker = new DiffCoreWorker(new URL('./worker.js', import.meta.url));

// Initialize with WASM bytes (supports zero-copy Transferable buffers)
await worker.init(wasmArrayBuffer);

// Stream chunks
await worker.pushLeft(chunk1);
await worker.pushRight(chunk2);

// Final results
const result = await worker.finalize();
```

## ⚙️ Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `maxMemoryBytes` | 32 MB | Hard limit for the result arena and internal buffers. |
| `maxInputSize` | 64 MB | Maximum combined size of left and right inputs. |
| `maxObjectKeys` | 100,000 | Prevents unbounded memory usage from adversarial deep nested objects. |
| `arrayDiffMode` | `Index` | `Index` (fast) or `HashWindow` (reorder detection). |

## 🛠️ Binary Result Protocol (v1.0)

For high-performance consumers, DiffCore exposes its raw result buffer using a compact binary mapping:

```text
[Header]
0-1:   u16 Major Version (1)
2-3:   u16 Minor Version (0)
4-7:   u32 Entry Count
8-15:  u64 Total Size (bytes)

[Entries] Repeat N times
0:     u8  Op (0=Added, 1=Removed, 2=Modified)
1-4:   u32 Path Length (Lp)
5..:   Path string (UTF-8, Lp bytes)
..:    u32 Left Value Length (Lv)
..:    Left value (UTF-8, missing if Added)
..:    u32 Right Value Length (Rv)
..:    Right value (UTF-8, missing if Removed)
..:    Padding to 8-byte alignment
```

## 📊 Performance Benchmarks

| Document Size | JS (deep-diff) | DiffCore (WASM) | Scaling |
|---------------|----------------|-----------------|---------|
| 10 KB | 0.45 ms | 1.69 ms | 0.27x |
| 100 KB | 5.34 ms | 10.03 ms | 0.53x |
| 1 MB | 48.27 ms | 57.79 ms | 0.84x |
| **10 MB** | **~300 ms** | **~150 ms** | **~2.0x** |

*Note: DiffCore wins on large payloads (>2MB) due to the absence of GC pressure and zero-copy memory semantics.*

## 📄 License

MIT
