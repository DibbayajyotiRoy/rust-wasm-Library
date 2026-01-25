//! Error handling for the diff engine.

use std::fmt;

/// Engine errors that can occur during operation.
#[derive(Debug, Clone)]
pub enum EngineError {
    /// Configuration is invalid
    InvalidConfig(String),
    /// Memory limit exceeded
    MemoryLimitExceeded,
    /// Input size limit exceeded
    InputLimitExceeded,
    /// Object key limit exceeded
    ObjectKeyLimitExceeded,
    /// Array too large for selected mode
    ArrayTooLarge,
    /// Engine has been sealed (finalized)
    EngineSealed,
    /// JSON parse error
    ParseError(String),
    /// Internal error
    Internal(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EngineError::InvalidConfig(msg) => write!(f, "invalid config: {}", msg),
            EngineError::MemoryLimitExceeded => write!(f, "memory limit exceeded"),
            EngineError::InputLimitExceeded => write!(f, "input size limit exceeded"),
            EngineError::ObjectKeyLimitExceeded => write!(f, "object key limit exceeded"),
            EngineError::ArrayTooLarge => write!(f, "array too large for selected diff mode"),
            EngineError::EngineSealed => write!(f, "engine sealed, no more input accepted"),
            EngineError::ParseError(msg) => write!(f, "parse error: {}", msg),
            EngineError::Internal(msg) => write!(f, "internal error: {}", msg),
        }
    }
}

/// Error buffer stored in the engine for cross-boundary access.
///
/// UTF-8 encoded, null-terminated for C compatibility.
#[derive(Debug, Default)]
pub struct ErrorBuffer {
    buffer: Vec<u8>,
}

impl ErrorBuffer {
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    /// Set error message. Ensures null termination.
    pub fn set(&mut self, error: &EngineError) {
        self.buffer.clear();
        let msg = error.to_string();
        self.buffer.extend_from_slice(msg.as_bytes());
        self.buffer.push(0); // Null terminate
    }

    /// Clear the error buffer.
    pub fn clear(&mut self) {
        self.buffer.clear();
    }

    /// Get pointer to error message (or null if empty).
    pub fn as_ptr(&self) -> *const u8 {
        if self.buffer.is_empty() {
            std::ptr::null()
        } else {
            self.buffer.as_ptr()
        }
    }

    /// Get length of error message (excluding null terminator).
    pub fn len(&self) -> u32 {
        if self.buffer.is_empty() {
            0
        } else {
            (self.buffer.len() - 1) as u32 // Exclude null terminator
        }
    }

    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }
}
