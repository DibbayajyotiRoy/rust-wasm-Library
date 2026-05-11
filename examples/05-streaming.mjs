// Streaming engine — push JSON in chunks. Useful when reading from a
// `ReadableStream`, an HTTP response, or a large file you don't want to load
// fully into memory all at once.
import { createReadStream } from "node:fs";
import { createEngine, Status } from "diffcore";

async function streamFile(engine, side, path) {
    const stream = createReadStream(path);
    for await (const chunk of stream) {
        const status = side === "left" ? engine.pushLeft(chunk) : engine.pushRight(chunk);
        if (status !== Status.Ok) throw new Error(`push failed: ${Status[status]}`);
    }
}

const engine = await createEngine();
await streamFile(engine, "left", "./before.json");
await streamFile(engine, "right", "./after.json");
const result = engine.finalize();

console.log(`${result.entries.length} change(s)`);
for (const e of result.entries) console.log(" ", e.path);
