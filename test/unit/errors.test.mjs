// Unit: typed error classes.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
    diff,
    DiffCoreError,
    InvalidJsonError,
    EngineDestroyedError,
    FinalizationError,
    createEngine,
    Status,
} from "../../dist/index.js";

test("errors: InvalidJsonError thrown for malformed LEFT input", async () => {
    let caught;
    try {
        await diff('{"a":}', '{"a":1}');
    } catch (err) {
        caught = err;
    }
    assert.ok(caught instanceof InvalidJsonError);
    assert.ok(caught instanceof DiffCoreError, "extends DiffCoreError");
    assert.equal(caught.side, "left");
    assert.match(caught.message, /left/);
});

test("errors: InvalidJsonError thrown for malformed RIGHT input", async () => {
    let caught;
    try {
        await diff('{"a":1}', '{"a":');
    } catch (err) {
        caught = err;
    }
    assert.ok(caught instanceof InvalidJsonError);
    assert.equal(caught.side, "right");
});

test("errors: InvalidJsonError carries a status code", async () => {
    let caught;
    try {
        await diff("not json at all", "{}");
    } catch (err) {
        caught = err;
    }
    assert.ok(caught instanceof InvalidJsonError);
    assert.ok(typeof caught.status === "number");
});

test("errors: EngineDestroyedError thrown when reusing destroyed engine", async () => {
    const engine = await createEngine();
    engine.destroy();

    let caught;
    try {
        engine.pushLeft(new TextEncoder().encode('{"a":1}'));
    } catch (err) {
        caught = err;
    }
    assert.ok(caught instanceof EngineDestroyedError);
    assert.ok(caught instanceof DiffCoreError);
});

test("errors: all error classes have correct .name property for telemetry", () => {
    assert.equal(new DiffCoreError("x").name, "DiffCoreError");
    assert.equal(new InvalidJsonError("left", Status.Error).name, "InvalidJsonError");
    assert.equal(new EngineDestroyedError().name, "EngineDestroyedError");
    assert.equal(new FinalizationError().name, "FinalizationError");
});

test("errors: error messages include actionable guidance", () => {
    // InvalidJsonError messages include a tip about what to do next.
    const e1 = new InvalidJsonError("left", Status.InputLimitExceeded);
    assert.match(e1.message, /maxInputSize|streaming/, "InputLimitExceeded mentions remedy");

    const e2 = new InvalidJsonError("right", Status.ObjectKeyLimitExceeded);
    assert.match(e2.message, /maxObjectKeys/, "ObjectKeyLimitExceeded names the config knob");

    const e3 = new EngineDestroyedError();
    assert.match(e3.message, /createEngine/, "tells you to create a new engine");
});
