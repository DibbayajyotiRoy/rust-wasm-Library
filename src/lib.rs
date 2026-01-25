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

/// Push a chunk of the left (original) JSON document.
///
/// # Safety
/// `engine_ptr` must be a valid pointer returned by `create_engine`.
#[no_mangle]
pub extern "C" fn push_left(engine_ptr: *mut Engine, chunk_ptr: *const u8, chunk_len: u32) -> Status {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return Status::InvalidHandle,
    };

    if chunk_ptr.is_null() {
        return Status::Error;
    }

    let chunk = unsafe { std::slice::from_raw_parts(chunk_ptr, chunk_len as usize) };
    engine.push_left(chunk)
}

/// Push a chunk of the right (modified) JSON document.
///
/// # Safety
/// `engine_ptr` must be a valid pointer returned by `create_engine`.
#[no_mangle]
pub extern "C" fn push_right(engine_ptr: *mut Engine, chunk_ptr: *const u8, chunk_len: u32) -> Status {
    let engine = match validate_engine(engine_ptr) {
        Some(e) => e,
        None => return Status::InvalidHandle,
    };

    if chunk_ptr.is_null() {
        return Status::Error;
    }

    let chunk = unsafe { std::slice::from_raw_parts(chunk_ptr, chunk_len as usize) };
    engine.push_right(chunk)
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

/// Allocate memory for the host to write input data.
#[no_mangle]
pub extern "C" fn alloc(len: u32) -> *mut u8 {
    let mut buf = Vec::with_capacity(len as usize);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf); // Host now owns this memory
    ptr
}

/// Free memory allocated by `alloc`.
#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, len: u32) {
    if !ptr.is_null() {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, 0, len as usize);
        }
    }
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
