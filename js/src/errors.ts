/**
 * Typed errors so callers can `instanceof` instead of regex-matching messages.
 */

import { Status } from "./types.js";

export class DiffCoreError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "DiffCoreError";
    }
}

export class InvalidJsonError extends DiffCoreError {
    constructor(
        public readonly side: "left" | "right",
        public readonly status: Status,
        details?: string
    ) {
        const tip =
            status === Status.InputLimitExceeded
                ? "Input exceeds maxInputSize. Bump `maxInputSize` or use streaming via createEngine()."
                : status === Status.ObjectKeyLimitExceeded
                ? "Object has too many keys. Bump `maxObjectKeys`."
                : status === Status.ArrayTooLarge
                ? "Array is too large for the configured mode. Switch arrayDiffMode or raise `maxFullArraySize`."
                : "Malformed JSON. Validate with JSON.parse() first.";
        super(
            `diffcore: failed to parse ${side} input (Status.${Status[status]}). ${tip}${details ? " — " + details : ""}`
        );
        this.name = "InvalidJsonError";
    }
}

export class EngineDestroyedError extends DiffCoreError {
    constructor() {
        super("diffcore: engine already destroyed. Create a new one with createEngine().");
        this.name = "EngineDestroyedError";
    }
}

export class FinalizationError extends DiffCoreError {
    constructor(details?: string) {
        super(
            `diffcore: finalization failed${details ? " — " + details : ""}. ` +
            "Inputs may exceed memory limits — try a larger maxMemoryBytes."
        );
        this.name = "FinalizationError";
    }
}
