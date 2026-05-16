/**
 * Deterministic fixture generator for head-to-head benchmarks.
 *
 * Uses mulberry32 (a small, fast, well-known seeded PRNG) so the same seed
 * produces the same payload on any machine. This is what makes the numbers
 * reproducible.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a JSON object of approximately `targetKb` kilobytes, populated with
 * keyed records `{ v: number, tag: string }`. Deterministic given a seed.
 */
export function buildPayload(targetKb, seed = 1) {
  const rand = mulberry32(seed);
  const target = targetKb * 1024;
  const items = [];
  let bytes = 2;
  let i = 0;
  while (bytes < target) {
    const v = rand();
    const tagLen = 32 + Math.floor(rand() * 16);
    const tag = "x".repeat(tagLen);
    const item = `"${i}":{"v":${v},"tag":"${tag}"}`;
    items.push(item);
    bytes += item.length + 1;
    i++;
  }
  return `{${items.join(",")}}`;
}

/**
 * Single deep mutation: change the `v` field of the last record to 0.
 * Mirrors the existing run.mjs methodology so numbers are comparable.
 */
export function mutateOne(parsed) {
  const keys = Object.keys(parsed);
  const lastKey = keys[keys.length - 1];
  parsed[lastKey] = { ...parsed[lastKey], v: 0 };
  return parsed;
}

export const SIZES_KB = [10, 100, 1000, 10000];