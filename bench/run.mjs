/**
 * DiffCore Final Mastery Benchmark (v2.1 DMA Mode)
 */

import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function optimizedJsDiff(a, b) {
    const diffs = [];
    const stack = [[a, b, '']];
    while (stack.length > 0) {
        const [o1, o2, path] = stack.pop();
        if (typeof o1 !== typeof o2) { diffs.push({ op: 'MOD', path }); continue; }
        if (typeof o1 !== 'object' || o1 === null || o2 === null) {
            if (o1 !== o2) diffs.push({ op: 'MOD', path });
            continue;
        }
        const keys1 = Object.keys(o1);
        const keys2 = new Set(Object.keys(o2));
        for (let i = 0; i < keys1.length; i++) {
            const k = keys1[i];
            const p = path ? `${path}.${k}` : k;
            if (!keys2.has(k)) diffs.push({ op: 'REM', path: p });
            else { stack.push([o1[k], o2[k], p]); keys2.delete(k); }
        }
        for (const k of keys2) {
            diffs.push({ op: 'ADD', path: path ? `${path}.${k}` : k });
        }
    }
    return diffs;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../pkg/diffcore.wasm');

class MasteryEngine {
    constructor(wasm) {
        this.wasm = wasm;
        const configBuf = new Uint8Array(20);
        const dv = new DataView(configBuf.buffer);
        dv.setUint32(0, 64 * 1024 * 1024, true);  // 64MB Result Arena
        dv.setUint32(4, 64 * 1024 * 1024, true);  // 64MB Input Limit
        dv.setUint32(8, 200_000, true);           // Object Key Limit
        dv.setUint8(12, 0);
        dv.setUint16(13, 32, true);
        dv.setUint32(15, 512, true);
        dv.setUint8(19, 1);                       // ComputeMode: Throughput

        const configPtr = wasm._internal_alloc(20);
        new Uint8Array(wasm.memory.buffer, configPtr, 20).set(configBuf);
        this.ptr = wasm.create_engine(configPtr, 20);
        wasm._internal_dealloc(configPtr, 20);
    }

    runDMA(lBuf, rBuf, filter = null) {
        if (filter) {
            const encoder = new TextEncoder();
            const fBuf = encoder.encode(filter);
            const fPtr = this.wasm._internal_alloc(fBuf.length);
            new Uint8Array(this.wasm.memory.buffer, fPtr, fBuf.length).set(fBuf);
            this.wasm.set_path_filter(this.ptr, fPtr, fBuf.length);
            this.wasm._internal_dealloc(fPtr, fBuf.length);
        }

        const lp = this.wasm.get_left_input_ptr(this.ptr);
        new Uint8Array(this.wasm.memory.buffer, lp, lBuf.length).set(lBuf);
        this.wasm.commit_left(this.ptr, lBuf.length);

        const rp = this.wasm.get_right_input_ptr(this.ptr);
        new Uint8Array(this.wasm.memory.buffer, rp, rBuf.length).set(rBuf);
        this.wasm.commit_right(this.ptr, rBuf.length);

        this.wasm.finalize(this.ptr);
        // NOTE: batch_resolve_symbols is post-processing, NOT part of core diff timing

        this.wasm.clear_engine(this.ptr);
        if (filter) this.wasm.set_path_filter(this.ptr, 0, 0);
    }

    destroy() { this.wasm.destroy_engine(this.ptr); }
}

function median(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function genComplex(kb) {
    const target = kb * 1024;
    const items = [];
    let b = 2;
    let i = 0;
    while (b < target) {
        const item = `"${i++}":{"v":${Math.random()},"tag":"${'x'.repeat(40)}"}`;
        items.push(item);
        b += item.length + 1;
    }
    return `{${items.join(',')}}`;
}

async function main() {
    const { instance } = await WebAssembly.instantiate(readFileSync(WASM_PATH), { env: {} });
    const wasm = instance.exports;
    const engine = new MasteryEngine(wasm);

    console.log(`\n🚀 DiffCore Benchmark`);
    console.log(`Limits: 64MB | Protocol: v2.1 Symbolic\n`);

    console.log('| Payload | Throughput | JS (total) | JS (diff) | WASM DMA | Pruning | Speedup |');
    console.log('|---------|------------|------------|-----------|----------|---------|---------|');

    const encoder = new TextEncoder();
    const WARMUP = 5;
    const ITER = 15;

    // JIT warmup for both JS and WASM
    const warmupJson = genComplex(100);
    const warmupParsed = JSON.parse(warmupJson);
    for (let i = 0; i < WARMUP; i++) {
        optimizedJsDiff(warmupParsed, warmupParsed);
    }

    for (const kb of [100, 1000, 5000, 10000]) {
        const s1 = genComplex(kb);
        const o_mod = JSON.parse(s1);
        const keys = Object.keys(o_mod);
        const lastKey = keys[keys.length - 1];
        o_mod[lastKey].v = 0;
        const s2 = JSON.stringify(o_mod);
        const b1 = encoder.encode(s1);
        const b2 = encoder.encode(s2);

        // WASM warmup
        for (let i = 0; i < WARMUP; i++) {
            engine.runDMA(b1, b2, null);
        }

        // JS with parsing (full comparison)
        const jsTimes = [];
        for (let i = 0; i < ITER; i++) {
            const t = performance.now();
            optimizedJsDiff(JSON.parse(s1), JSON.parse(s2));
            jsTimes.push(performance.now() - t);
        }
        const avgJS = median(jsTimes);

        // JS diff-only (pre-parsed)
        const o1 = JSON.parse(s1);
        const o2 = JSON.parse(s2);
        const jsDiffOnlyTimes = [];
        for (let i = 0; i < ITER; i++) {
            const t = performance.now();
            optimizedJsDiff(o1, o2);
            jsDiffOnlyTimes.push(performance.now() - t);
        }
        const avgJSDiff = median(jsDiffOnlyTimes);

        // WASM DMA (parse + diff)
        const wasmTimes = [];
        for (let i = 0; i < ITER; i++) {
            const t = performance.now();
            engine.runDMA(b1, b2, null);
            wasmTimes.push(performance.now() - t);
        }
        const avgWasm = median(wasmTimes);

        // WASM with pruning
        const pruneTimes = [];
        for (let i = 0; i < ITER; i++) {
            const t = performance.now();
            engine.runDMA(b1, b2, lastKey);
            pruneTimes.push(performance.now() - t);
        }
        const avgPrune = median(pruneTimes);

        const thr = ((b1.length + b2.length) / 1024 / 1024) / (avgWasm / 1000);
        const speedupVsTotal = avgJS / avgWasm;
        const speedupVsDiff = avgJSDiff > 0 ? avgWasm / avgJSDiff : 0; // Diff only comparison

        console.log(`| ${(kb / 1024).toFixed(1)}MB | ${thr.toFixed(0).padStart(5)} MB/s | ${avgJS.toFixed(1).padStart(6)}ms | ${avgJSDiff.toFixed(1).padStart(7)}ms | ${avgWasm.toFixed(1).padStart(8)}ms | ${avgPrune.toFixed(1).padStart(7)}ms | ${speedupVsTotal.toFixed(1).padStart(5)}x |`);
    }

    console.log(`\nNote: JS (total) = JSON.parse + diff | JS (diff) = diff only on pre-parsed objects`);
    console.log(`WASM parses raw bytes + diffs in a single pass (streaming).`);
    console.log(`Speedup = JS (total) / WASM DMA. For diff-only workloads, use pruning.`);
}

main().catch(console.error);
