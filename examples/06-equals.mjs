// equals(a, b) — fast structural-equality check.
// Returns the same answer as `diff(a, b).entries.length === 0` but with a
// reference-equality short-circuit and a cleaner intent.
import { equals } from "diffcore";

const a = '{"a":1,"b":2}';
const b = '{"a":1,"b":2}';
console.log(await equals(a, b));   // true

// Combine with `ignore` for noisy fields (timestamps, request IDs, etc.):
const x = '{"data":{"x":1},"fetchedAt":1730000000}';
const y = '{"data":{"x":1},"fetchedAt":1730005000}';
console.log(await equals(x, y, { ignore: ["/fetchedAt"] })); // true
