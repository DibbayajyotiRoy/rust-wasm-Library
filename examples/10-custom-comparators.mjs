// "Equal enough" comparisons — treat timestamps as equal within tolerance,
// numbers within epsilon, strings case-insensitively, etc.
import { diffWith, dateTolerance, numericTolerance, caseInsensitive } from "diffcore/state";

const a = {
    createdAt: "2025-01-01T00:00:00.000Z",
    score: 1.0,
    name: "Alice",
};
const b = {
    createdAt: "2025-01-01T00:00:00.500Z", // 500ms later
    score: 1.005,                          // tiny float drift
    name: "alice",                         // different case
};

const result = await diffWith(JSON.stringify(a), JSON.stringify(b), {
    "/createdAt": dateTolerance(1000),    // within 1 second
    "/score":     numericTolerance(0.01), // within 0.01
    "/name":      caseInsensitive(),      // case-insensitive string equality
});

console.log(result.entries.length);  // 0 — nothing reported as different
