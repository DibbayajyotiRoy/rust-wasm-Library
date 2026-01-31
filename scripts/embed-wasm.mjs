#!/usr/bin/env node
/**
 * WASM Embedding Script
 * 
 * Embeds the compiled WASM binary as Base64 into a JS module for zero-config usage.
 * Also copies raw WASM for advanced users who prefer external loading.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

// Read WASM binary
const wasmPath = join(root, 'pkg', 'diffcore.wasm');

if (!existsSync(wasmPath)) {
    console.error('❌ WASM file not found at:', wasmPath);
    console.error('   Run "npm run build:wasm" first.');
    process.exit(1);
}

const wasmBuffer = readFileSync(wasmPath);
const wasmBase64 = wasmBuffer.toString('base64');
const wasmSizeKB = (wasmBuffer.length / 1024).toFixed(1);

// Generate embedded loader module
const embeddedLoader = `// Auto-generated WASM loader - DO NOT EDIT
// Generated: ${new Date().toISOString()}
// WASM Size: ${wasmSizeKB} KB

const WASM_BASE64 = "${wasmBase64}";

/** @type {WebAssembly.Module | null} */
let cachedModule = null;

/**
 * Get the pre-compiled WASM module.
 * Uses cached module on subsequent calls.
 * @returns {Promise<WebAssembly.Module>}
 */
export async function getWasmModule() {
    if (cachedModule) return cachedModule;

    // Decode Base64 to binary
    const binaryString = atob(WASM_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    cachedModule = await WebAssembly.compile(bytes);
    return cachedModule;
}

/**
 * Get raw WASM bytes for custom instantiation.
 * @returns {Uint8Array}
 */
export function getWasmBytes() {
    const binaryString = atob(WASM_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
`;

// Write embedded loader
writeFileSync(join(distDir, 'wasm-embedded.js'), embeddedLoader);

// Generate TypeScript declarations
const embeddedDts = `// Auto-generated type declarations for wasm-embedded.js

/**
 * Get the pre-compiled WASM module.
 * Uses cached module on subsequent calls.
 */
export function getWasmModule(): Promise<WebAssembly.Module>;

/**
 * Get raw WASM bytes for custom instantiation.
 */
export function getWasmBytes(): Uint8Array;
`;

writeFileSync(join(distDir, 'wasm-embedded.d.ts'), embeddedDts);

// Copy raw WASM for advanced users
copyFileSync(wasmPath, join(distDir, 'diffcore.wasm'));

console.log(`✓ Embedded WASM (${wasmSizeKB} KB) into dist/wasm-embedded.js`);
console.log(`✓ Copied raw WASM to dist/diffcore.wasm`);
console.log(`✓ Generated dist/wasm-embedded.d.ts`);

