// UX scenario: Config-file watcher.
// A service reloads a YAML/JSON config when it changes on disk. The dev
// wants a clean log: "feature X went from disabled to enabled" — not
// "the lastModifiedAt timestamp changed."

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diff, equals, formatDiff } from "../../dist/index.js";

test("config-watch: identical reload (after `touch config.json`) shows no changes", async () => {
    const config = {
        features: { auth: true, billing: false },
        limits: { rps: 100 },
        _meta: { lastModifiedAt: 1730000000, fingerprint: "abc123" },
    };
    const reloaded = { ...config, _meta: { lastModifiedAt: 1730005000, fingerprint: "def456" } };

    const isReallyChanged = !(await equals(
        JSON.stringify(config),
        JSON.stringify(reloaded),
        { ignore: ["/_meta"] }
    ));
    assert.equal(isReallyChanged, false, "metadata-only reload is a no-op for our logger");
});

test("config-watch: real edit reports exactly what flipped", async () => {
    const before = {
        features: { auth: true, billing: false, beta: false },
        limits: { rps: 100 },
        _meta: { lastModifiedAt: 1, fingerprint: "x" },
    };
    const after = {
        features: { auth: true, billing: true, beta: false },
        limits: { rps: 200 },
        _meta: { lastModifiedAt: 2, fingerprint: "y" },
    };

    const patch = await diff(JSON.stringify(before), JSON.stringify(after), {
        ignore: ["/_meta"],
    });
    const realPaths = patch.entries.map((e) => e.path).sort();
    assert.deepEqual(realPaths, ["/features/billing", "/limits/rps"]);
});

test("config-watch: pretty-print exactly what changed for the operator log", async () => {
    const before = '{"features":{"auth":true,"billing":false}}';
    const after  = '{"features":{"auth":true,"billing":true}}';

    const result = await diff(before, after);
    const line = formatDiff(result, { color: false });

    assert.match(line, /~\s+\/features\/billing/);
    assert.match(line, /false/);
    assert.match(line, /true/);
    // Operator can paste this directly into the ops chat.
});
