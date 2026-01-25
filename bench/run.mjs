/**
 * DiffCore Real-World Scaling Benchmark
 * 
 * Compares:
 * 1. JS: JSON.parse(bytes) -> jsDeepDiff(obj1, obj2)
 * 2. WASM: Engine.push(bytes) -> Engine.finalize()
 */

import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function jsDeepDiff(a, b) {
    let diffCount = 0;
    for (const key in a) {
        if (!(key in b)) diffCount++;
        else if (typeof a[key] === 'object' && a[key] !== null) {
            diffCount += jsDeepDiff(a[key], b[key]);
        } else if (a[key].v !== b[key].v) {
            diffCount++;
        }
    }
    for (const key in b) if (!(key in a)) diffCount++;
    return diffCount;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../pkg/diffcore.wasm');

class FastEngine {
    constructor(instance) {
        this.wasm = instance.exports;
        this.memory = this.wasm.memory;
        const configPtr = this.wasm.alloc(19);
        const dv = new DataView(this.memory.buffer, configPtr, 19);
        dv.setUint32(0, 128 * 1024 * 1024, true);
        dv.setUint32(4, 64 * 1024 * 1024, true);
        dv.setUint32(8, 1_000_000, true);
        dv.setUint8(12, 0);
        dv.setUint16(13, 64, true);
        dv.setUint32(15, 1024, true);
        this.ptr = this.wasm.create_engine(configPtr, 19);
        this.wasm.dealloc(configPtr, 19);
    }
    run(lBuf, rBuf) {
        const lPtr = this.wasm.alloc(lBuf.length);
        new Uint8Array(this.memory.buffer, lPtr, lBuf.length).set(lBuf);
        this.wasm.push_left(this.ptr, lPtr, lBuf.length);
        const rPtr = this.wasm.alloc(rBuf.length);
        new Uint8Array(this.memory.buffer, rPtr, rBuf.length).set(rBuf);
        this.wasm.push_right(this.ptr, rPtr, rBuf.length);
        this.wasm.finalize(this.ptr);
        this.wasm.dealloc(lPtr, lBuf.length);
        this.wasm.dealloc(rPtr, rBuf.length);
    }
    destroy() { this.wasm.destroy_engine(this.ptr); }
}

function generate(kb) {
    const target = kb * 1024;
    const items = [];
    let b = 2;
    let i = 0;
    while (b < target) {
        const item = `"${i++}":{"v":${Math.random()},"s":"${'x'.repeat(40)}"}`;
        items.push(item);
        b += item.length + 1;
    }
    return `{${items.join(',')}}`;
}

async function main() {
    const mod = await WebAssembly.compile(readFileSync(WASM_PATH));
    const inst = await WebAssembly.instantiate(mod, { env: {} });

    console.log('DiffCore Real-World Performance (includes parsing)\n');
    console.log('| Size | JS Total (ms) | WASM Total (ms) | Speedup |');
    console.log('|------|---------------|-----------------|---------|');

    const encoder = new TextEncoder();

    for (const kb of [10, 100, 1000, 10000]) {
        const s1 = generate(kb);
        const o_base = JSON.parse(s1);
        const o_mod = JSON.parse(s1); o_mod["999"] = { v: 0, s: '' };
        const s2 = JSON.stringify(o_mod);

        const b1 = encoder.encode(s1);
        const b2 = encoder.encode(s2);

        // Warmup
        new FastEngine(inst).run(b1, b2);

        // JS: parse + diff
        const t0 = performance.now();
        const ITER = 5;
        for (let i = 0; i < ITER; i++) {
            const j1 = JSON.parse(s1);
            const j2 = JSON.parse(s2);
            jsDeepDiff(j1, j2);
        }
        const jsAvg = (performance.now() - t0) / ITER;

        // WASM: push + finalize (engine reuse)
        const t1 = performance.now();
        for (let i = 0; i < ITER; i++) {
            const engine = new FastEngine(inst);
            engine.run(b1, b2);
            engine.destroy();
        }
        const wasmAvg = (performance.now() - t1) / ITER;

        console.log(`| ${kb.toString().padStart(5)}KB | ${jsAvg.toFixed(3).padStart(13)} | ${wasmAvg.toFixed(3).padStart(15)} | ${(jsAvg / wasmAvg).toFixed(2).padStart(7)}x |`);
    }
}

main().catch(console.error);
