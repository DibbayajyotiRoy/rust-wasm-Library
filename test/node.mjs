/**
 * DiffCore Node.js Integration Test
 * 
 * Verifies the WASM module works correctly in Node.js.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../pkg/diffcore.wasm');

async function test() {
    console.log('DiffCore Node.js Test\n');

    // Load WASM
    console.log('Loading WASM module...');
    const wasmBuffer = readFileSync(WASM_PATH);
    const module = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(module, { env: {} });
    const exports = instance.exports;

    console.log('WASM exports:', Object.keys(exports));

    // Test 1: Create and destroy engine
    console.log('\nTest 1: Create/destroy engine...');
    {
        const enginePtr = exports.create_engine(0, 0);
        assert(enginePtr !== 0, 'Engine should be created');

        const status = exports.destroy_engine(enginePtr);
        assert(status === 0, 'Destroy should return Ok');

        // Double destroy should be safe
        const status2 = exports.destroy_engine(enginePtr);
        assert(status2 === 4, 'Double destroy should return InvalidHandle');

        console.log('✓ Create/destroy works correctly');
    }

    // Test 2: Simple diff
    console.log('\nTest 2: Simple diff...');
    {
        const memory = exports.memory;
        memory.grow(10); // Ensure enough memory

        const enginePtr = exports.create_engine(0, 0);
        assert(enginePtr !== 0, 'Engine created');

        const leftJson = '{"a": 1, "b": 2}';
        const rightJson = '{"a": 1, "b": 3, "c": 4}';

        const leftBytes = new TextEncoder().encode(leftJson);
        const rightBytes = new TextEncoder().encode(rightJson);

        const memView = new Uint8Array(memory.buffer);

        // Push left
        const leftOffset = 1024;
        memView.set(leftBytes, leftOffset);
        const leftStatus = exports.push_left(enginePtr, leftOffset, leftBytes.length);
        assert(leftStatus === 0, `push_left should return Ok, got ${leftStatus}`);

        // Push right
        const rightOffset = leftOffset + leftBytes.length + 8;
        memView.set(rightBytes, rightOffset);
        const rightStatus = exports.push_right(enginePtr, rightOffset, rightBytes.length);
        assert(rightStatus === 0, `push_right should return Ok, got ${rightStatus}`);

        // Finalize
        const resultPtr = exports.finalize(enginePtr);
        assert(resultPtr !== 0, 'Finalize should return valid pointer');

        const resultLen = exports.get_result_len(enginePtr);
        assert(resultLen > 0, 'Result should have length');

        // Parse result header
        const resultView = new DataView(memory.buffer, resultPtr, resultLen);
        const major = resultView.getUint16(0, true);
        const minor = resultView.getUint16(2, true);
        const entryCount = resultView.getUint32(4, true);

        console.log(`  Version: ${major}.${minor}`);
        console.log(`  Entry count: ${entryCount}`);
        console.log(`  Result size: ${resultLen} bytes`);

        assert(major === 1, 'Major version should be 1');
        assert(entryCount > 0, 'Should have diff entries');

        exports.destroy_engine(enginePtr);
        console.log('✓ Simple diff works correctly');
    }

    // Test 3: Input limit enforcement
    console.log('\nTest 3: Input limit enforcement...');
    {
        const memory = exports.memory;

        // Create engine with tiny config
        // Config format: [u32 max_mem][u32 max_input][u32 max_keys][u8 mode][u16 window][u32 max_arr]
        const configBuf = new ArrayBuffer(19);
        const configView = new DataView(configBuf);
        configView.setUint32(0, 1024 * 1024, true);  // 1MB max memory
        configView.setUint32(4, 100, true);          // 100 bytes max input (tiny!)
        configView.setUint32(8, 100, true);          // 100 max keys
        configView.setUint8(12, 0);                  // Index mode
        configView.setUint16(13, 64, true);          // window size
        configView.setUint32(15, 1024, true);        // max full array

        const configOffset = 512;
        new Uint8Array(memory.buffer).set(new Uint8Array(configBuf), configOffset);

        const enginePtr = exports.create_engine(configOffset, 19);
        assert(enginePtr !== 0, 'Engine created with config');

        // Try to push data larger than limit
        const largeData = new TextEncoder().encode('{"x": "' + 'a'.repeat(200) + '"}');
        const dataOffset = 1024;
        new Uint8Array(memory.buffer).set(largeData, dataOffset);

        const status = exports.push_left(enginePtr, dataOffset, largeData.length);
        assert(status === 2, `Should return InputLimitExceeded (2), got ${status}`);

        exports.destroy_engine(enginePtr);
        console.log('✓ Input limit enforcement works correctly');
    }

    // Test 4: Sealed engine protection
    console.log('\nTest 4: Sealed engine protection...');
    {
        const memory = exports.memory;
        const enginePtr = exports.create_engine(0, 0);

        const data = new TextEncoder().encode('{}');
        const offset = 1024;
        new Uint8Array(memory.buffer).set(data, offset);

        exports.push_left(enginePtr, offset, data.length);
        exports.push_right(enginePtr, offset, data.length);
        exports.finalize(enginePtr);

        // Try to push after finalize
        const status = exports.push_left(enginePtr, offset, data.length);
        assert(status === 3, `Should return EngineSealed (3), got ${status}`);

        exports.destroy_engine(enginePtr);
        console.log('✓ Sealed engine protection works correctly');
    }

    console.log('\n✅ All tests passed!');
}

test().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
