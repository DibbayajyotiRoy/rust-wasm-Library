/**
 * DiffCore Protocol v2 Benchmark
 * 
 * Major Architecture Shift:
 * 1. Zero-Allocation Diff: Finalize only emits a list of [PathId, Offsets].
 * 2. Lazy Materialization: Paths reconstructed only on demand via resolve_path_symbol.
 * 3. 16-byte Aligned Header v2.0.
 */

import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function structuralDiff(a, b, path = '') {
    const diffs = [];
    if (typeof a !== typeof b) { diffs.push({ op: 'MOD', path }); return diffs; }
    if (typeof a !== 'object' || a === null || b === null) {
        if (a !== b) diffs.push({ op: 'MOD', path });
        return diffs;
    }
    const keysA = Object.keys(a);
    const keysB = new Set(Object.keys(b));
    for (const key of keysA) {
        const nextPath = path ? `${path}.${key}` : key;
        if (!keysB.has(key)) diffs.push({ op: 'REM', path: nextPath });
        else { diffs.push(...structuralDiff(a[key], b[key], nextPath)); keysB.delete(key); }
    }
    for (const key of keysB) diffs.push({ op: 'ADD', path: path ? `${path}.${key}` : key });
    return diffs;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../pkg/diffcore.wasm');

class V2Engine {
    constructor(wasm) {
        this.wasm = wasm;
        const configPtr = wasm.alloc(19);
        const dv = new DataView(wasm.memory.buffer, configPtr, 19);
        dv.setUint32(0, 512 * 1024 * 1024, true);
        dv.setUint32(4, 256 * 1024 * 1024, true);
        dv.setUint32(8, 1_000_000, true);
        dv.setUint8(12, 0);
        dv.setUint16(13, 64, true);
        dv.setUint32(15, 1024, true);
        this.ptr = wasm.create_engine(configPtr, 19);
        wasm.dealloc(configPtr, 19);
    }

    run(lBuf, rBuf, materialize = false) {
        const lp = this.wasm.alloc(lBuf.length);
        new Uint8Array(this.wasm.memory.buffer, lp, lBuf.length).set(lBuf);
        this.wasm.push_left(this.ptr, lp, lBuf.length);

        const rp = this.wasm.alloc(rBuf.length);
        new Uint8Array(this.wasm.memory.buffer, rp, rBuf.length).set(rBuf);
        this.wasm.push_right(this.ptr, rp, rBuf.length);

        const resultPtr = this.wasm.finalize(this.ptr);
        const headerDV = new DataView(this.wasm.memory.buffer, resultPtr, 16);
        const count = headerDV.getUint32(4, true);

        const results = [];
        if (materialize) {
            for (let i = 0; i < count; i++) {
                const off = 16 + i * 24;
                const entryTs = new DataView(this.wasm.memory.buffer, resultPtr + off, 24);
                const op = entryTs.getUint8(0);
                const pathId = entryTs.getUint32(1, true);

                // Lazy Materialization
                const symPtr = this.wasm.resolve_path_symbol(this.ptr, pathId);
                const symLen = this.wasm.get_symbol_len(this.ptr);
                const path = new TextDecoder().decode(new Uint8Array(this.wasm.memory.buffer, symPtr, symLen));
                results.push({ op, path });
            }
        }

        this.wasm.dealloc(lp, lBuf.length);
        this.wasm.dealloc(rp, rBuf.length);
        this.wasm.clear_engine(this.ptr);
        return results;
    }

    destroy() { this.wasm.destroy_engine(this.ptr); }
}

function generate(kb) {
    const target = kb * 1024;
    const items = [];
    let b = 2;
    let i = 0;
    while (b < target) {
        const item = `"${i++}":{"id":${i},"v":${Math.random()},"nested":{"a":1,"b":"val_${i}"}}`;
        items.push(item);
        b += item.length + 1;
    }
    return `{${items.join(',')}}`;
}

async function main() {
    const { instance } = await WebAssembly.instantiate(readFileSync(WASM_PATH), { env: {} });
    const wasm = instance.exports;
    const engine = new V2Engine(wasm);

    console.log('DiffCore Protocol v2.0 Performance (Symbolic Output)\n');
    console.log('| Size | JS Total (ms) | WASM Hot (ms) | Speedup |');
    console.log('|------|---------------|-----------------|---------|');

    const encoder = new TextEncoder();

    for (const kb of [10, 100, 1000, 10000]) {
        process.stdout.write(`Benchmarking ${kb}KB... `);
        const s1 = generate(kb);
        const o_mod = JSON.parse(s1);
        o_mod[Object.keys(o_mod)[0]].v = 0;
        const s2 = JSON.stringify(o_mod);
        const b1 = encoder.encode(s1);
        const b2 = encoder.encode(s2);

        // Warmup
        engine.run(b1, b2, false);

        const ITER = 10;
        const t0 = performance.now();
        for (let i = 0; i < ITER; i++) {
            const j1 = JSON.parse(s1);
            const j2 = JSON.parse(s2);
            structuralDiff(j1, j2);
        }
        const jsAvg = (performance.now() - t0) / ITER;

        const t1 = performance.now();
        for (let i = 0; i < ITER; i++) {
            engine.run(b1, b2, false); // Symbolic mode (Pure compute)
        }
        const wasmHotAvg = (performance.now() - t1) / ITER;

        // WASM Full (Compute + Materialize)
        const t2 = performance.now();
        for (let i = 0; i < ITER; i++) {
            engine.run(b1, b2, true);
        }
        const wasmFullAvg = (performance.now() - t2) / ITER;

        process.stdout.write("Done.\n");
        console.log(`| ${kb.toString().padStart(5)}KB | ${jsAvg.toFixed(3).padStart(13)} | ${wasmHotAvg.toFixed(3).padStart(9)} / ${wasmFullAvg.toFixed(3).padStart(9)} | ${(jsAvg / wasmFullAvg).toFixed(2).padStart(7)}x |`);
    }
}

main().catch(console.error);
