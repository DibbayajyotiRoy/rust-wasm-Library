# Integration Guide: DiffCore v0.1

Follow this guide to integrate DiffCore's high-performance symbolic compute engine into your application.

## �️ Step 1: Acquisition

### Option A: Clone from GitHub
```bash
git clone https://github.com/DibbayajyotiRoy/rust-wasm-Library
cd rust-wasm-Library
```

### Option B: Download Release
Download pre-built `.wasm` assets from [GitHub Releases](https://github.com/DibbayajyotiRoy/rust-wasm-Library/releases).

## 🔨 Step 2: Building from Source
Ensure you have `rustup` and `wasm-pack` installed.

```bash
# Build for all platforms (Browser/Bundler/Node.js)
wasm-pack build --target web --release
```

The resulting `pkg/` directory contains the core engine and JS bridge.

---

## 🌍 Platform Specific Integration

### 1. Website / Web Applications (React, Vue, Vite)
The engine is most efficient when running in a **Web Worker**.

```javascript
import init, { create_engine, get_left_input_ptr, commit_left, finalize } from './pkg/diffcore.js';

async function run() {
    await init(); // Load WASM
    const config = new Uint8Array(20); 
    // fill config (64MB arena, 64MB input)...
    const engine = create_engine(config, 20);
    
    // DMA Pattern (Zero-Copy)
    const ptr = get_left_input_ptr(engine);
    new Uint8Array(wasm_memory.buffer, ptr, data.length).set(data);
    commit_left(engine, data.length);
}
```

### 2. Mobile Applications (React Native, Capacitor)
- **Capacitor/Ionic**: Follow the **Web** pattern, ensuring the `.wasm` file is in your `assets/` directory.
- **React Native**: Use direct binary loading via a JSI-based bridge for maximum throughput.

### 3. Desktop Applications (Electron)
Always execute diffing in an **Electron Utility Process** to prevent UI blocking.

```javascript
// main.js
const { UtilityProcess } = require('electron');
const child = UtilityProcess.fork('./diff_worker.mjs');

// diff_worker.mjs
import { readFileSync } from 'fs';
const wasmBuffer = readFileSync('./pkg/diffcore.wasm');
const { instance } = await WebAssembly.instantiate(wasmBuffer);
```

---

## �️ Industrial Performance Patterns (v0.1)

1.  **DMA Access**: Use `get_left_input_ptr` to write directly into WASM memory. This eliminates the host-to-guest copy wall.
2.  **Path Pruning**: Set a filter (`set_path_filter`) to skip character scanning for irrelevant JSON subtrees.
3.  **Engine Reuse**: Call `clear_engine()` to reset state without freeing the heap. This maintains peak throughput.
