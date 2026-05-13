// UX scenario: CI pipelines that need to detect "did this JSON change?"
// `npx diffcore a.json b.json --silent` is the answer — exit 0/1/2.
// This tests the published `dist/cli.js` end-to-end.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

function tmp() {
    return mkdtempSync(join(tmpdir(), "diffcore-cli-"));
}

function run(args, dir) {
    return spawnSync("node", [CLI, ...args], { cwd: dir, encoding: "utf8" });
}

test("cli: exit 0 when files are identical", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.json"), '{"x":1}');
    writeFileSync(join(dir, "b.json"), '{"x":1}');
    const r = run(["a.json", "b.json", "--silent"], dir);
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 0, "identical files → exit 0");
});

test("cli: exit 1 when files differ", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.json"), '{"x":1}');
    writeFileSync(join(dir, "b.json"), '{"x":2}');
    const r = run(["a.json", "b.json", "--silent"], dir);
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 1, "different files → exit 1");
});

test("cli: exit 2 when a file is missing (operator error)", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.json"), '{"x":1}');
    const r = run(["a.json", "nonexistent.json"], dir);
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 2, "missing input → exit 2");
});

test("cli: --json emits valid RFC 6902 JSON Patch", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.json"), '{"x":1}');
    writeFileSync(join(dir, "b.json"), '{"x":2}');
    const r = run(["a.json", "b.json", "--json"], dir);
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 1);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed[0].op, "replace");
    assert.equal(parsed[0].path, "/x");
    assert.equal(parsed[0].value, 2);
});

test("cli: human-readable diff includes path and arrow", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.json"), '{"name":"Alice"}');
    writeFileSync(join(dir, "b.json"), '{"name":"Bob"}');
    const r = run(["a.json", "b.json", "--no-color"], dir);
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /\/name/);
    assert.match(r.stdout, /Alice/);
    assert.match(r.stdout, /Bob/);
});
