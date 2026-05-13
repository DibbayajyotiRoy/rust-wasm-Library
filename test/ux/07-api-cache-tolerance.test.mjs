// UX scenario: API response caching.
// We poll an endpoint every minute. The response always has a fresh
// `serverTime` and slightly drifting numeric fields (latencies, gauges).
// "Did anything REAL change?" is the question. If no, skip the re-render.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { equals } from "../../dist/index.js";
import { diffWith, dateTolerance, numericTolerance } from "../../dist/state.js";

test("api-cache: nothing real changed → skip re-render", async () => {
    const previous = {
        serverTime: "2025-01-01T00:00:00.000Z",
        cpuUsage: 0.412,
        memUsage: 0.578,
        services: ["auth", "billing", "api"],
    };
    const next = {
        serverTime: "2025-01-01T00:00:30.000Z",   // 30 s later, expected
        cpuUsage: 0.413,                          // tiny float drift
        memUsage: 0.579,                          // tiny float drift
        services: ["auth", "billing", "api"],
    };

    const noiseFiltered = await equals(
        JSON.stringify(previous),
        JSON.stringify(next),
        { ignore: ["/serverTime"] }
    );
    // With just ignore, cpuUsage and memUsage still differ.
    assert.equal(noiseFiltered, false);

    // Now also tolerate tiny numeric drift:
    const realDiff = await diffWith(JSON.stringify(previous), JSON.stringify(next), {
        "/cpuUsage": numericTolerance(0.01),
        "/memUsage": numericTolerance(0.01),
    });
    // Only serverTime should still be in there:
    assert.equal(realDiff.entries.length, 1);
    assert.equal(realDiff.entries[0].path, "/serverTime");

    // Combining gets us to zero — skip the re-render.
    const reallyEquals =
        (await diffWith(JSON.stringify(previous), JSON.stringify(next), {
            "/serverTime": dateTolerance(60_000),
            "/cpuUsage":   numericTolerance(0.01),
            "/memUsage":   numericTolerance(0.01),
        })).entries.length === 0;
    assert.equal(reallyEquals, true);
});

test("api-cache: real change still surfaces past the tolerance", async () => {
    const previous = { cpuUsage: 0.4 };
    const next     = { cpuUsage: 0.95 };

    const diffResult = await diffWith(
        JSON.stringify(previous),
        JSON.stringify(next),
        { "/cpuUsage": numericTolerance(0.01) }
    );
    assert.equal(diffResult.entries.length, 1, "0.55 jump exceeds 0.01 tolerance");
});
