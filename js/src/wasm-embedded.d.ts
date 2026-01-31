// Auto-generated type declarations for wasm-embedded.js
// This file is a placeholder for development - actual file is generated during build

/**
 * Get the pre-compiled WASM module.
 * Uses cached module on subsequent calls.
 */
export function getWasmModule(): Promise<WebAssembly.Module>;

/**
 * Get raw WASM bytes for custom instantiation.
 */
export function getWasmBytes(): Uint8Array;
