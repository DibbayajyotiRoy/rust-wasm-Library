//! Status codes for WASM boundary operations.

/// Status codes returned by engine operations.
///
/// These are used for backpressure and error signaling across the WASM boundary.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    /// Operation completed successfully
    Ok = 0,
    /// Internal buffer is full, call finalize or increase limits
    NeedFlush = 1,
    /// Input size limit exceeded
    InputLimitExceeded = 2,
    /// Engine has been finalized, no more input accepted
    EngineSealed = 3,
    /// Invalid engine handle (null, already destroyed, or corrupted)
    InvalidHandle = 4,
    /// Object key limit exceeded
    ObjectKeyLimitExceeded = 5,
    /// Array too large for selected diff mode
    ArrayTooLarge = 6,
    /// Generic error (check get_last_error for details)
    Error = 255,
}

impl Status {
    /// Returns true if the operation succeeded
    #[inline]
    pub fn is_ok(self) -> bool {
        self == Status::Ok
    }

    /// Returns true if the operation can be retried after handling
    #[inline]
    pub fn is_recoverable(self) -> bool {
        matches!(self, Status::NeedFlush)
    }
}
