/**
 * Head-to-head benchmark: diffcore vs fast-json-patch vs deep-diff vs jsondiffpatch.
 *
 * Two modes per library, per size:
 *   - total: JSON.parse(left) + JSON.parse(right) + diff
 *   - diffOnly: diff on pre-parsed objects
 *
 * diffcore is a special case: it parses raw bytes inside the WASM engine in a
 * single pass, so "total" for diffcore is one call. For diff-only we still
 * pass strings (its API is string-in) but skip the JS-side parse cost from the
 * other libraries' "total" time. That's the fairest read.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPayload, mutateOne, SIZES_KB } from "./fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, "../pkg/diffcore.wasm");

const WARMUP = 5;
const ITER = 15;
const SEED = 42;

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function p95(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

async function loadCompetitors() {
  const [fjp, dd, jdp] = await Promise.all([
    import("fast-json-patch"),
    import("deep-diff"),
    import("jsondiffpatch"),
  ]);
  return {
    fastJsonPatch: fjp.default ?? fjp,
    deepDiff: dd.default ?? dd,
    jsondiffpatch: jdp.create ? jdp.create() : (jdp.default?.create ? jdp.default.create() : jdp),
  };
}

class DiffcoreEngine {
  constructor(wasm) {
    this.wasm = wasm;
    const cfg = new Uint8Array(20);
    const dv = new DataView(cfg.buffer);
    dv.setUint32(0, 64 * 1024 * 1024, true);
    dv.setUint32(4, 64 * 1024 * 1024, true);
    dv.setUint32(8, 200_000, true);
    dv.setUint8(12, 0);
    dv.setUint16(13, 32, true);
    dv.setUint32(15, 512, true);
    dv.setUint8(19, 1);
    const ptr = wasm._internal_alloc(20);
    new Uint8Array(wasm.memory.buffer, ptr, 20).set(cfg);
    this.engine = wasm.create_engine(ptr, 20);
    wasm._internal_dealloc(ptr, 20);
  }

  run(lBuf, rBuf) {
    const lp = this.wasm.get_left_input_ptr(this.engine);
    new Uint8Array(this.wasm.memory.buffer, lp, lBuf.length).set(lBuf);
    this.wasm.commit_left(this.engine, lBuf.length);
    const rp = this.wasm.get_right_input_ptr(this.engine);
    new Uint8Array(this.wasm.memory.buffer, rp, rBuf.length).set(rBuf);
    this.wasm.commit_right(this.engine, rBuf.length);
    this.wasm.finalize(this.engine);
    this.wasm.clear_engine(this.engine);
  }
}

function timeIt(fn) {
  const times = [];
  for (let i = 0; i < WARMUP; i++) fn();
  for (let i = 0; i < ITER; i++) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  return { median: median(times), p95: p95(times) };
}

async function main() {
  const { instance } = await WebAssembly.instantiate(readFileSync(WASM_PATH), { env: {} });
  const wasm = instance.exports;
  const dc = new DiffcoreEngine(wasm);

  const { fastJsonPatch, deepDiff, jsondiffpatch } = await loadCompetitors();

  const enc = new TextEncoder();
  const rows = [];

  console.log("Methodology");
  console.log(`  node ${process.version} on ${process.platform}-${process.arch}`);
  console.log(`  warmup=${WARMUP} iter=${ITER} seed=${SEED}`);
  console.log(`  mutation: single deep .v=0 on last record`);
  console.log("");

  for (const kb of SIZES_KB) {
    const left = buildPayload(kb, SEED);
    const leftParsed = JSON.parse(left);
    const rightParsed = mutateOne(JSON.parse(left));
    const right = JSON.stringify(rightParsed);
    const lBuf = enc.encode(left);
    const rBuf = enc.encode(right);
    const bytes = lBuf.length + rBuf.length;
    const mb = bytes / 1024 / 1024;

    console.log(`# ${kb} KB  (left=${(lBuf.length / 1024).toFixed(1)}KB right=${(rBuf.length / 1024).toFixed(1)}KB)`);

    const diffcoreTotal = timeIt(() => dc.run(lBuf, rBuf));

    const fjpTotal = timeIt(() => {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      fastJsonPatch.compare(a, b);
    });
    const fjpDiff = timeIt(() => fastJsonPatch.compare(leftParsed, rightParsed));

    const ddTotal = timeIt(() => {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      deepDiff.diff(a, b);
    });
    const ddDiff = timeIt(() => deepDiff.diff(leftParsed, rightParsed));

    const jdpTotal = timeIt(() => {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      jsondiffpatch.diff(a, b);
    });
    const jdpDiff = timeIt(() => jsondiffpatch.diff(leftParsed, rightParsed));

    const tput = (ms) => (mb / (ms / 1000)).toFixed(0);

    const r = {
      sizeKb: kb,
      bytes,
      diffcore_total_ms: +diffcoreTotal.median.toFixed(2),
      diffcore_total_mbps: +tput(diffcoreTotal.median),
      fjp_total_ms: +fjpTotal.median.toFixed(2),
      fjp_total_mbps: +tput(fjpTotal.median),
      fjp_diffonly_ms: +fjpDiff.median.toFixed(2),
      dd_total_ms: +ddTotal.median.toFixed(2),
      dd_total_mbps: +tput(ddTotal.median),
      dd_diffonly_ms: +ddDiff.median.toFixed(2),
      jdp_total_ms: +jdpTotal.median.toFixed(2),
      jdp_total_mbps: +tput(jdpTotal.median),
      jdp_diffonly_ms: +jdpDiff.median.toFixed(2),
      speedup_vs_fjp: +(fjpTotal.median / diffcoreTotal.median).toFixed(2),
      speedup_vs_dd: +(ddTotal.median / diffcoreTotal.median).toFixed(2),
      speedup_vs_jdp: +(jdpTotal.median / diffcoreTotal.median).toFixed(2),
    };
    rows.push(r);

    console.log(
      `  diffcore       ${diffcoreTotal.median.toFixed(2).padStart(8)}ms  ${tput(diffcoreTotal.median).padStart(4)} MB/s`
    );
    console.log(
      `  fast-json-patch ${fjpTotal.median.toFixed(2).padStart(7)}ms  ${tput(fjpTotal.median).padStart(4)} MB/s  (diff-only ${fjpDiff.median.toFixed(2)}ms)`
    );
    console.log(
      `  deep-diff      ${ddTotal.median.toFixed(2).padStart(8)}ms  ${tput(ddTotal.median).padStart(4)} MB/s  (diff-only ${ddDiff.median.toFixed(2)}ms)`
    );
    console.log(
      `  jsondiffpatch  ${jdpTotal.median.toFixed(2).padStart(8)}ms  ${tput(jdpTotal.median).padStart(4)} MB/s  (diff-only ${jdpDiff.median.toFixed(2)}ms)`
    );
    console.log(
      `  -> diffcore is ${r.speedup_vs_fjp}x vs fast-json-patch, ${r.speedup_vs_dd}x vs deep-diff, ${r.speedup_vs_jdp}x vs jsondiffpatch (total time)`
    );
    console.log("");
  }

  mkdirSync(join(__dirname, "results"), { recursive: true });
  const meta = {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    warmup: WARMUP,
    iter: ITER,
    seed: SEED,
    timestamp: new Date().toISOString(),
    rows,
  };
  writeFileSync(join(__dirname, "results", "competitors.json"), JSON.stringify(meta, null, 2));
  console.log(`Wrote bench/results/competitors.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
