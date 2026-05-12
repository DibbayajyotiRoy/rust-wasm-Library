// Sending diffs over the wire — `toJSON()` strips bigint pathIds and byte
// buffers so the payload is a clean, small JSON object.
import { diff, applyPatch } from "diffcore";

// On the server:
const beforeState = { count: 1, items: [{ id: "a" }] };
const afterState  = { count: 2, items: [{ id: "a" }, { id: "b" }] };

const result = await diff(JSON.stringify(beforeState), JSON.stringify(afterState));
const wirePayload = JSON.stringify(result.toJSON());   // safe to send

console.log("payload size:", wirePayload.length, "bytes");

// On the client (or vice versa):
const received = JSON.parse(wirePayload);
const reconstructed = applyPatch(beforeState, received.entries);
console.log("reconstructed === after:",
    JSON.stringify(reconstructed) === JSON.stringify(afterState));
