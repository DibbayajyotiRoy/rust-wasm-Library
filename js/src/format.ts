/**
 * Pretty-print diff results for human eyes (logs, CLIs, dev tools).
 */

import { DiffOp, type DiffEntry, type DiffResult, type JsonScalar } from "./types.js";

const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

export interface FormatOptions {
    /** Add ANSI color codes. Default: auto (TTY in Node, off elsewhere). */
    color?: boolean;
    /** Show the path as a header above each change. Default: false. */
    grouped?: boolean;
    /** Maximum characters per value before truncation. Default: 80. */
    maxValueLength?: number;
}

function autoColor(): boolean {
    if (typeof globalThis === "object" && "process" in globalThis) {
        const proc = (globalThis as { process?: { stdout?: { isTTY?: boolean }; env?: Record<string, string | undefined> } }).process;
        if (proc?.env?.NO_COLOR) return false;
        if (proc?.env?.FORCE_COLOR) return true;
        return Boolean(proc?.stdout?.isTTY);
    }
    return false;
}

function formatScalar(v: JsonScalar | undefined, max: number): string {
    if (v === undefined) return "—";
    let s: string;
    if (typeof v === "string") s = JSON.stringify(v);
    else s = String(v);
    if (s.length > max) s = s.slice(0, max - 1) + "…";
    return s;
}

/**
 * Render a diff as a colored, unified-style text blob suitable for `console.log`.
 *
 * @example
 * ```ts
 * const result = await diff(oldJson, newJson);
 * console.log(formatDiff(result));
 * // ~ /users/0/name   "Alice" → "Bob"
 * // + /users/1        {"name": "Carol"}
 * // - /users/2/email  "old@example.com"
 * ```
 */
export function formatDiff(diff: DiffResult | DiffEntry[], options: FormatOptions = {}): string {
    const entries = Array.isArray(diff) ? diff : diff.entries;
    const color = options.color ?? autoColor();
    const max = options.maxValueLength ?? 80;
    const c = (code: string, s: string) => (color ? `${code}${s}${ANSI.reset}` : s);

    if (entries.length === 0) {
        return c(ANSI.dim, "(no changes)");
    }

    // Compute padding for paths to keep arrows aligned.
    const longestPath = Math.min(
        Math.max(...entries.map((e) => e.path.length || 1)),
        48
    );

    const lines: string[] = [];
    for (const e of entries) {
        const pathStr = e.path === "" ? "(root)" : e.path;
        const path = pathStr.padEnd(longestPath, " ");
        if (e.op === DiffOp.Added) {
            lines.push(`${c(ANSI.green, "+")} ${c(ANSI.cyan, path)}  ${c(ANSI.green, formatScalar(e.rightValue, max))}`);
        } else if (e.op === DiffOp.Removed) {
            lines.push(`${c(ANSI.red, "-")} ${c(ANSI.cyan, path)}  ${c(ANSI.red, formatScalar(e.leftValue, max))}`);
        } else {
            lines.push(
                `${c(ANSI.yellow, "~")} ${c(ANSI.cyan, path)}  ` +
                `${c(ANSI.red, formatScalar(e.leftValue, max))} ${c(ANSI.dim, "→")} ${c(ANSI.green, formatScalar(e.rightValue, max))}`
            );
        }
    }
    return lines.join("\n");
}
