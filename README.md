# DiffCore: Silicon Path JSON Compute Engine (v2.2)

DiffCore is a world-class WebAssembly compute engine designed for ultra-high-speed structural comparison of large JSON documents. It leverages the **Silicon Path Architecture**—a stateless, zero-allocation pipeline based on rolling 64-bit path hashes and SIMD structural indexing.

## ✨ Key Features

- **🚀 Extreme Throughput**: Reaches **800 MB/s+** on standard hardware, saturating memory bandwidth.
- **🧬 Silicon Path**: Zero-allocation hot loop using 64-bit rolling hashes instead of expensive Tries.
- **⚡ SIMD Accelerated**: Stage 1 structural indexing and Stage 2 parallel value hashing via `v128`.
- **🌊 Constant Memory**: Deterministic memory footprint via symbolic DMA ingestion.

## 🚀 Performance (Silicon Path Verified)

![Silicon Path Benchmark](/home/roy/.gemini/antigravity/brain/75de158f-bd2f-4c0d-9f67-9fafacd54a57/uploaded_image_1769534452648.png)

| Payload | Throughput | Speedup (vs JS Total) |
|---------|------------|------------------------|
| 1.0 MB | **817 MB/s** | **5.0x** |
| 9.8 MB | **676 MB/s** | **5.4x** |

*Note: JS Baseline uses V8's highly optimized `JSON.parse` + iterative diff. WASM parses raw bytes and diffs in a single unified pass.*

## 📦 Rapid Integration

```bash
# Add as direct GitHub dependency
bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library
```

```javascript
import { DiffEngine } from './pkg/diffcore.js';

// Initialize Silicon Path Engine
const engine = new DiffEngine(wasm, { computeMode: 'Throughput' });
```

## ⚙️ Engineering Principles

1.  **Stateless Dispatch**: Path identity is computed on-the-fly, eliminating Trie lookups.
2.  **Bandwidth Bound**: Optimized to saturate linear memory throughput via SIMD.
3.  **Symbolic-First**: Defer path string materialization until the display layer.

## 📄 License

MIT
