# DiffCore: High-Performance JSON Diff Engine

DiffCore is a production-ready WebAssembly compute engine designed for ultra-high-speed structural comparison of JSON documents. It leverages a stateless, zero-allocation pipeline based on rolling 64-bit path hashes and SIMD structural indexing.

## 🚀 Installation

```bash
npm install diffcore
# or
bun add diffcore
```

**Zero toolchain required**. Pre-compiled WASM is bundled and auto-loaded.

## ✨ Key Features

### Production Ready
- **NPM Registry**: Standard `npm install` - no compilers needed
- **Auto Memory Management**: `FinalizationRegistry` cleans up WASM resources automatically
- **Zero-Config API**: Single `import { diff } from 'diffcore'` with embedded WASM

### Performance
- **750 MB/s+ Throughput**: Saturates memory bandwidth on modern hardware
- **3-4x Faster**: Outperforms JavaScript `JSON.parse` + diff implementations
- **Zero-Allocation Engine**: 64-bit rolling hashes instead of object trees

### Architecture  
- **SIMD Accelerated**: Structural indexing and parallel value hashing via `v128`
- **Streaming Support**: Process large documents in chunks
- **All JSON Types**: Numbers, booleans, null, strings, arrays, nested objects

## 🛠️ Usage

### One-Line Diff
```javascript
import { diff } from 'diffcore';

const result = await diff(
  '{"name": "Alice", "age": 30}',
  '{"name": "Bob", "age": 31}'
);

console.log(result.entries);
// [{ op: 2, path: '$.h...', leftValue: 'Alice', rightValue: 'Bob' }, ...]
```

### Streaming Engine
```javascript
import { createEngine } from 'diffcore';

const engine = await createEngine();
engine.pushLeft(leftChunk);
engine.pushRight(rightChunk);
const result = engine.finalize();
// No .destroy() needed - automatic cleanup!
```

### Advanced: Custom WASM Loading
```javascript
import { createEngineWithWasm } from 'diffcore';

const wasm = await WebAssembly.instantiateStreaming(fetch('/custom.wasm'));
const engine = new DiffEngine(wasm.instance.exports);
```

## 📊 Benchmarks

| Payload | Throughput | JS (total) | DiffCore | Speedup |
|---------|------------|------------|----------|---------|
| 100KB   | 750 MB/s   | 1.1ms      | 0.3ms    | **4.1x** |
| 1MB     | 635 MB/s   | 11.9ms     | 3.1ms    | **3.9x** |
| 5MB     | 602 MB/s   | 60.6ms     | 16.2ms   | **3.7x** |
| 10MB    | 464 MB/s   | 126.5ms    | 42.1ms   | **3.0x** |

*JS (total) = JSON.parse + diff. DiffCore parses and diffs in a single streaming pass.*

## 💎 Architecture Highlights

### Symbolic Path Dispatch
Path identity computed on-the-fly via rolling hashes. String materialization deferred until result extraction.

### Direct Memory Access (DMA)
Host applications write directly into WASM linear memory, eliminating the "copy wall" between JS and WASM.

### SIMD Parallelism
- **Stage 1**: Structural indexing for rapid tokenization
- **Stage 2**: Parallel value hashing via 128-bit SIMD

### Memory Efficiency
Rolling hashes instead of object trees = predictable memory footprint as document complexity grows.

---

## License

MIT License - [DibbayajyotiRoy](https://github.com/DibbayajyotiRoy)
