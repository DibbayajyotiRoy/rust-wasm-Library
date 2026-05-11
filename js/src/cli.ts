#!/usr/bin/env node
/**
 * `npx diffcore a.json b.json` — print a colored diff to the terminal.
 *
 * Flags:
 *   --json         emit RFC 6902 JSON Patch instead of pretty output
 *   --raw          emit raw DiffResult JSON (paths, ops, values)
 *   --no-color     disable ANSI colors
 *   --silent       suppress all output and exit non-zero if changes were found
 *   --help, -h
 */

import { readFile } from "node:fs/promises";
import { diff } from "./index.js";
import { toJsonPatch } from "./patch.js";
import { formatDiff } from "./format.js";

const USAGE = `diffcore — JSON diff CLI

Usage:
  diffcore <left.json> <right.json> [flags]

Flags:
  --json       emit RFC 6902 JSON Patch
  --raw        emit raw DiffResult JSON
  --no-color   disable ANSI colors
  --silent     no output; exit 1 if changes found
  -h, --help   show this help

Exits 0 if files are identical, 1 if they differ, 2 on error.`;

async function readInput(arg: string): Promise<string> {
    if (arg === "-") {
        const chunks: Buffer[] = [];
        for await (const c of process.stdin) chunks.push(c as Buffer);
        return Buffer.concat(chunks).toString("utf8");
    }
    return readFile(arg, "utf8");
}

async function main(): Promise<number> {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
        process.stdout.write(USAGE + "\n");
        return args.length === 0 ? 2 : 0;
    }
    const positional = args.filter((a) => !a.startsWith("--") && a !== "-h");
    const flags = new Set(args.filter((a) => a.startsWith("--") || a === "-h"));
    if (positional.length < 2) {
        process.stderr.write("error: expected two file paths (use '-' for stdin)\n\n" + USAGE + "\n");
        return 2;
    }
    const [leftArg, rightArg] = positional;

    let leftText: string;
    let rightText: string;
    try {
        [leftText, rightText] = await Promise.all([readInput(leftArg), readInput(rightArg)]);
    } catch (err) {
        process.stderr.write(`error: ${(err as Error).message}\n`);
        return 2;
    }

    let result;
    try {
        result = await diff(leftText, rightText);
    } catch (err) {
        process.stderr.write(`error: ${(err as Error).message}\n`);
        return 2;
    }

    const changed = result.entries.length > 0;

    if (flags.has("--silent")) {
        return changed ? 1 : 0;
    }
    if (flags.has("--json")) {
        process.stdout.write(JSON.stringify(toJsonPatch(result), null, 2) + "\n");
        return changed ? 1 : 0;
    }
    if (flags.has("--raw")) {
        const safe = {
            ...result,
            entries: result.entries.map((e) => ({
                ...e,
                pathId: e.pathId.toString(16),
                leftBytes: undefined,
                rightBytes: undefined,
            })),
            raw: undefined,
        };
        process.stdout.write(JSON.stringify(safe, null, 2) + "\n");
        return changed ? 1 : 0;
    }
    process.stdout.write(formatDiff(result, { color: !flags.has("--no-color") }) + "\n");
    return changed ? 1 : 0;
}

main().then(
    (code) => process.exit(code),
    (err: unknown) => {
        process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
        process.exit(2);
    }
);
