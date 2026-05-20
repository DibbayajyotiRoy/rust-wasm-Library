//! DiffCore: High-performance streaming JSON diff engine
//!
//! This module provides the WebAssembly entry points for the diff engine.
//! All functions are designed for zero-copy operation on WASM linear memory.



mod config;
mod diff;
mod engine;
mod error;
mod memory;
mod parser;
mod path;
mod simd_index;
mod status;

pub use config::{ArrayDiffMode, EngineConfig};
pub use status::Status;

use engine::Engine;
use std::ptr;

/// Magic header for engine validation (0xD1FFC0RE)
const ENGINE_MAGIC: u32 = 0xD1FF_C0AE;

// ============================================================================
// WASM EXPORTS - Minimal ABI Surface
// ============================================================================

/// Create a new diff engine with the given configuration.
///
/// # Arguments
/// * `config_ptr` - Pointer to configuration bytes in linear memory
/// * `config_len` - Length of configuration bytes
///
/// # Returns
/// Pointer to the engine, or null on failure.
#[no_mangle]
pub extern "C" fn create_engine(config_ptr: *const u8, config_len: u32) -> *mut Engine {
    let config = if config_ptr.is_null() || config_len == 0 {
        EngineConfig::default()
    } else {
        let config_slice = unsafe { std::slice::from_raw_parts(config_ptr, config_len as usize) };
        match EngineConfig::from_bytes(config_slice) {
            Ok(c) => c,
            Err(_) => return ptr::null_mut(),
        }
    };

    match Engine::new(config, ENGINE_MAGIC) {
        Ok(engine) => Box::into_raw(Box::new(engine)),
        Err(_) => ptr::null_mut(),
    }
}

/// Signal that N bytes have been written into the managed left input buffer.
#[no_mangle]
pub extern "C" fn commit_left(engine_ptr: *mut Engine, len: u32) -> Status {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return Status::InvalidHandle,
    };
    engine.commit_left(len)
}

/// Signal that N bytes have been written into the managed right input buffer.
#[no_mangle]
pub extern "C" fn commit_right(engine_ptr: *mut Engine, len: u32) -> Status {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return Status::InvalidHandle,
    };
    engine.commit_right(len)
}

/// Return the managed pointer for the left input buffer.
#[no_mangle]
pub extern "C" fn get_left_input_ptr(engine_ptr: *mut Engine) -> *mut u8 {
    match validate_engine(engine_ptr) {
        Some(e) => e.left_input_ptr(),
        None => std::ptr::null_mut(),
    }
}

/// Return the managed pointer for the right input buffer.
#[no_mangle]
pub extern "C" fn get_right_input_ptr(engine_ptr: *mut Engine) -> *mut u8 {
    match validate_engine(engine_ptr) {
        Some(e) => e.right_input_ptr(),
        None => std::ptr::null_mut(),
    }
}

/// Finalize the diff computation and return pointer to result.
///
/// After calling this, no more chunks can be pushed.
/// The returned pointer points to the result buffer in linear memory.
#[no_mangle]
pub extern "C" fn finalize(engine_ptr: *mut Engine) -> *const u8 {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return ptr::null(),
    };

    match engine.finalize() {
        Ok(result_ptr) => result_ptr,
        Err(_) => ptr::null(),
    }
}

/// Get the length of the result buffer.
#[no_mangle]
pub extern "C" fn get_result_len(engine_ptr: *const Engine) -> u32 {
    let engine = match validate_engine_const(engine_ptr) {
        Some(e) => e,
        None => return 0,
    };

    engine.result_len()
}

/// Destroy the engine and free all associated memory.
///
/// This function is safe to call multiple times (double-free safe).
#[no_mangle]
pub extern "C" fn destroy_engine(engine_ptr: *mut Engine) -> Status {
    if engine_ptr.is_null() {
        return Status::Ok; // Already destroyed or never created
    }

    // Check magic before destroying
    let engine = unsafe { &mut *engine_ptr };
    if engine.magic() != ENGINE_MAGIC {
        return Status::InvalidHandle;
    }

    // Zero the magic to prevent double-free
    engine.clear_magic();

    // Drop the engine
    unsafe {
        let _ = Box::from_raw(engine_ptr);
    }

    Status::Ok
}

/// Reset the engine state for a new diff operation without re-allocating heap.
#[no_mangle]
pub extern "C" fn clear_engine(engine_ptr: *mut Engine) -> Status {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return Status::InvalidHandle,
    };

    engine.clear();
    Status::Ok
}

/// Get pointer to the last error message.
#[no_mangle]
pub extern "C" fn get_last_error(engine_ptr: *const Engine) -> *const u8 {
    let engine = match validate_engine_const(engine_ptr) {
        Some(e) => e,
        None => return ptr::null(),
    };

    engine.last_error_ptr()
}

/// Get the length of the last error message (UTF-8, null-terminated).
#[no_mangle]
pub extern "C" fn get_last_error_len(engine_ptr: *const Engine) -> u32 {
    let engine = match validate_engine_const(engine_ptr) {
        Some(e) => e,
        None => return 0,
    };
    engine.last_error_len()
}

// ============================================================================
// Internal Helpers
// ============================================================================

fn validate_engine(ptr: *mut Engine) -> Option<&'static mut Engine> {
    if ptr.is_null() {
        return None;
    }

    let engine = unsafe { &mut *ptr };
    if engine.magic() != ENGINE_MAGIC {
        return None;
    }

    Some(engine)
}

fn validate_engine_const(ptr: *const Engine) -> Option<&'static Engine> {
    if ptr.is_null() {
        return None;
    }

    let engine = unsafe { &*ptr };
    if engine.magic() != ENGINE_MAGIC {
        return None;
    }

    Some(engine)
}
