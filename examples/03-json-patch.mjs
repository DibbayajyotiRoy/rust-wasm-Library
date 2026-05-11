// Emit a standard RFC 6902 JSON Patch document — interoperable with
// `fast-json-patch`, `jsondiffpatch`, and any IETF-compliant patch consumer.
import { diff, toJsonPatch } from "diffcore";

const result = await diff(
    JSON.stringify({ a: 1, b: 2 }),
    JSON.stringify({ a: 1, b: 3, c: 4 })
);

console.log(JSON.stringify(toJsonPatch(result), null, 2));
// [
//   { "op": "replace", "path": "/b", "value": 3 },
//   { "op": "add",     "path": "/c", "value": 4 }
// ]
