import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load WASM
const wasmBuffer = readFileSync(join(__dirname, '../pkg/diffcore_cpp.wasm'));

// Provide minimal WASI imports for standalone WASM
const wasiImports = {
    wasi_snapshot_preview1: {
        fd_write: () => 0,
        fd_close: () => 0,
        fd_seek: () => 0,
        proc_exit: () => { },
        environ_sizes_get: () => 0,
        environ_get: () => 0,
    },
    env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 4096 }),
    }
};

const { instance } = await WebAssembly.instantiate(wasmBuffer, wasiImports);
const wasm = instance.exports;

console.log('🚀 DiffCore v1.0 C++ Emscripten Benchmark\n');
console.log('Available exports:', Object.keys(wasm).filter(k => !k.startsWith('_')));

// Generate test payload
function genComplex(kb) {
    const items = [];
    for (let i = 0; i < kb * 12; i++) {
        items.push(`"${i}":{"v":${Math.random()},"t":"${'x'.repeat(25)}"}`);
    }
    return `{${items.join(',')}}`;
}

const sizes = [100, 1000, 5000, 10000];
const ITER = 5;

console.log('\n| Payload | JS Avg | C++ WASM | Speedup |');
console.log('|---------|--------|----------|---------|');

for (const kb of sizes) {
    const s1 = genComplex(kb);
    const s2 = s1.replace(/"v":\d\.\d+/, '"v":0.0');

    const b1 = new TextEncoder().encode(s1);
    const b2 = new TextEncoder().encode(s2);

    // JS Baseline (Parse + Diff)
    let tJS = performance.now();
    for (let j = 0; j < ITER; j++) {
        const o1 = JSON.parse(s1);
        const o2 = JSON.parse(s2);
        const keys = Object.keys(o1);
        for (const k of keys) if (o1[k].v !== o2[k].v) break;
    }
    const avgJS = (performance.now() - tJS) / ITER;

    // C++ WASM
    let avgCPP = 0;
    const create_engine = wasm._create_engine || wasm.create_engine;
    const memory = wasm.memory || wasiImports.env.memory;

    if (create_engine) {
        try {
            const engine = create_engine(128 * 1024 * 1024, 128 * 1024 * 1024);
            const get_left = wasm._get_left_input_ptr || wasm.get_left_input_ptr;
            const get_right = wasm._get_right_input_ptr || wasm.get_right_input_ptr;
            const commit_l = wasm._commit_left || wasm.commit_left;
            const commit_r = wasm._commit_right || wasm.commit_right;
            const finalize_fn = wasm._finalize || wasm.finalize;
            const clear_fn = wasm._clear_engine || wasm.clear_engine;
            const destroy_fn = wasm._destroy_engine || wasm.destroy_engine;

            let tCPP = performance.now();
            for (let j = 0; j < ITER; j++) {
                const lp = get_left(engine);
                const rp = get_right(engine);

                new Uint8Array(memory.buffer, lp, b1.length).set(b1);
                new Uint8Array(memory.buffer, rp, b2.length).set(b2);

                commit_l(engine, b1.length);
                commit_r(engine, b2.length);
                finalize_fn(engine);
                clear_fn(engine);
            }
            avgCPP = (performance.now() - tCPP) / ITER;

            destroy_fn(engine);
        } catch (e) {
            console.log(`  C++ Error at ${(kb / 1024).toFixed(1)}MB: ${e.message}`);
            avgCPP = 999;
        }
    } else {
        console.log('  C++ create_engine not found');
        console.log('  Available:', Object.keys(wasm).slice(0, 10));
        avgCPP = 999;
    }

    const speedup = avgCPP < 999 ? (avgJS / avgCPP).toFixed(1) : 'N/A';
    console.log(`| ${(kb / 1024).toFixed(1)}MB | ${avgJS.toFixed(2)}ms | ${avgCPP.toFixed(2)}ms | ${speedup}x |`);
}
