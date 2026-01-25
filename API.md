# DiffCore API Reference

Detailed documentation for the DiffCore classes and types.

## `DiffEngine`

The main class management the WASM lifecycle and diff computation.

### `constructor(wasm: any, config?: DiffCoreConfig)`
Initializes the engine.
- `wasm`: The exports from the loaded WASM module.
- `config`: Optional configuration object.

### `pushLeft(chunk: Uint8Array): Status`
Pushes a chunk of the original (left) data.
- Returns a `Status` code.

### `pushRight(chunk: Uint8Array): Status`
Pushes a chunk of the modified (right) data.
- Returns a `Status` code.

### `finalize(): DiffResult`
Completes the diffing process and returns the results. 
**Note**: The engine is "sealed" after this call and cannot accept more chunks.

### `destroy(): void`
Frees all WASM memory associated with this engine. MUST be called to prevent memory leaks.

---

## `DiffCoreWorker`

Safe off-main-thread execution wrapper for use in browsers.

### `init(wasmBytes: ArrayBuffer, config?: DiffCoreConfig): Promise<void>`
Initializes the background worker with the WASM binary. Uses `Transferable` for zero-copy.

### `pushLeft(buffer: ArrayBuffer): Promise<Status>`
Sends original chunk to the worker.

### `pushRight(buffer: ArrayBuffer): Promise<Status>`
Sends modified chunk to the worker.

### `finalize(): Promise<DiffResult>`
Asks the worker to compute and return the result.

---

## Enums and Types

### `Status`
- `Ok (0)`: Operation successful.
- `Error (1)`: Generic processing error.
- `InputLimitExceeded (2)`: Data pushed exceeded `maxInputSize`.
- `EngineSealed (3)`: Attempted to push data after `finalize()`.
- `InvalidHandle (4)`: Engine state corrupted or destroyed.
- `ObjectKeyLimitExceeded (5)`: Too many unique keys in an object.

### `DiffOp`
- `Added (0)`
- `Removed (1)`
- `Modified (2)`

### `DiffResult`
```typescript
interface DiffResult {
  entries: {
    op: DiffOp;
    path: string;
    leftValue?: string;
    rightValue?: string;
  }[];
  version: string; // e.g., "1.0"
}
```
