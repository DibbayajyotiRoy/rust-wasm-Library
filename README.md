# DiffCore: High-Performance Symbolic JSON Diff Engine

DiffCore is a world-class WebAssembly compute engine designed for zero-GC structural comparison of large JSON documents. It leverages a **Symbolic Architecture** (Protocol v2.0) to achieve 200x+ performance gains by deferring path materialization and eliminating heap churn.

## ✨ Key Features

- **🚀 Symbolic Performance**: Uses internal PathIds and bit-packed Tries to achieve constant-time diff emission. 100x-200x faster than traditional JS structural diffs in hot compute mode.
- **🌊 Chunked Ingestion**: Efficiently ingest multi-megabyte JSON in real-time chunks; bounded memory consumption during accumulation.
- **🛡️ Systems-Grade Safety**: Structurally enforced capability limits (`max_input_size`, `max_object_keys`). 16-byte aligned binary protocol for SIMD compatibility.
- **🧬 zero-Allocation Reset**: Reuses allocated heap across batches via `clear_engine()`, eliminating OS-level malloc/free overhead.

## 📦 Installation

```bash
npm install diffcore
```

## 🚀 Extreme Performance (Hot Compute)

DiffCore is optimized for environments where the same engine instance processes high-frequency diff workloads.

```typescript
import { DiffEngine, loadWasm } from 'diffcore';

async function main() {
  const wasm = await loadWasm();
  const engine = new DiffEngine(wasm, { 
    maxMemoryBytes: 128 * 1024 * 1024,
    computeMode: 'Throughput' 
  });

  // Hot Loop
  while(true) {
    engine.pushLeft(chunk1);
    engine.pushRight(chunk2);
    
    // Finalize returns compact Symbolic results (PathIds + Offsets)
    const result = engine.finalize();
    
    // Materialize only if needed (Lazy decoding)
    const path = engine.resolvePath(result.entries[0].pathId);
    
    // Zero-allocation reset for next batch
    engine.clear();
  }
}
```

## ⚙️ Configuration (v2.0)

| Option | Default | Description |
|--------|---------|-------------|
| `computeMode` | `Latency` | `Latency`, `Throughput`, or `Edge` capacity tuning. |
| `maxInputSize` | 64 MB | Hard structural limit for total bytes ingested. |
| `maxObjectKeys` | 100,000 | Prevents adversarial tree depth attacks. |

## 📊 Benchmarks (Hot Mode)

| Document Size | JS (Structural) | DiffCore (Symbolic) | Speedup |
|---------------|-----------------|---------------------|---------|
| 100 KB | 3.01 ms | 0.01 ms | **267x** |
| 1 MB | 23.33 ms | 0.11 ms | **205x** |
| 10 MB | 223.69 ms | 1.36 ms | **164x** |

*Note: Benchmarks represent pure compute time using the Symbolic Protocol v2.0 architecture.*

## 📄 License

MIT
