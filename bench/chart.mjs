/**
 * Reads bench/results/competitors.json and writes a self-contained SVG bar chart
 * comparing throughput (MB/s, total time including parse) across all four libraries.
 *
 * Output: bench/results/throughput.svg
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "results", "competitors.json"), "utf8"));

const W = 880;
const H = 460;
const PAD_L = 70;
const PAD_R = 24;
const PAD_T = 60;
const PAD_B = 80;
const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

const libs = [
  { key: "diffcore_total_mbps", label: "diffcore", color: "#d97706" },
  { key: "fjp_total_mbps", label: "fast-json-patch", color: "#475569" },
  { key: "jdp_total_mbps", label: "jsondiffpatch", color: "#94a3b8" },
  { key: "dd_total_mbps", label: "deep-diff", color: "#cbd5e1" },
];

const sizes = data.rows.map((r) => `${r.sizeKb < 1000 ? r.sizeKb + "KB" : r.sizeKb / 1000 + "MB"}`);
const groups = data.rows.length;
const maxVal = Math.max(...data.rows.flatMap((r) => libs.map((l) => r[l.key])));
const yMax = Math.ceil(maxVal / 100) * 100;

const groupW = innerW / groups;
const barW = (groupW * 0.78) / libs.length;
const groupGap = groupW * 0.22;

const xForGroup = (g) => PAD_L + g * groupW + groupGap / 2;
const yFor = (v) => PAD_T + innerH - (v / yMax) * innerH;

const ticks = 5;
const tickStep = yMax / ticks;
const yTicks = Array.from({ length: ticks + 1 }, (_, i) => i * tickStep);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace,Menlo,monospace" font-size="12">
<rect width="${W}" height="${H}" fill="#fafaf9"/>
<text x="${PAD_L}" y="28" font-size="16" font-weight="600" fill="#0c0a09">Throughput, MB/s — total time including JSON.parse</text>
<text x="${PAD_L}" y="46" font-size="11" fill="#57534e">${data.platform} · node ${data.node} · median of ${data.iter} iterations after ${data.warmup} warmup</text>
`;

for (const t of yTicks) {
  const y = yFor(t);
  svg += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#e7e5e4" stroke-width="1"/>`;
  svg += `<text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" fill="#78716c">${t.toFixed(0)}</text>`;
}

for (let g = 0; g < groups; g++) {
  const r = data.rows[g];
  const gx = xForGroup(g);
  for (let i = 0; i < libs.length; i++) {
    const lib = libs[i];
    const v = r[lib.key];
    const x = gx + i * barW;
    const y = yFor(v);
    const h = PAD_T + innerH - y;
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${lib.color}"/>`;
    if (lib.label === "diffcore") {
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" fill="#0c0a09" font-weight="600">${v}</text>`;
    }
  }
  svg += `<text x="${(gx + (groupW - groupGap) / 2).toFixed(1)}" y="${(PAD_T + innerH + 18).toFixed(1)}" text-anchor="middle" fill="#0c0a09">${sizes[g]}</text>`;
}

const legendY = H - 30;
let legendX = PAD_L;
for (const lib of libs) {
  svg += `<rect x="${legendX}" y="${legendY - 10}" width="12" height="12" fill="${lib.color}"/>`;
  svg += `<text x="${legendX + 18}" y="${legendY}" fill="#0c0a09">${lib.label}</text>`;
  legendX += 8 + 12 + 8 + lib.label.length * 7;
}

svg += `</svg>`;

writeFileSync(join(__dirname, "results", "throughput.svg"), svg);
console.log("Wrote bench/results/throughput.svg");
