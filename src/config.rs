//! Engine configuration with capability-based limits.

/// Array diff mode determines how arrays are compared.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ArrayDiffMode {
    /// Position-based comparison only. Fast, no reorder detection.
    #[default]
    Index = 0,
    /// Rolling hash window comparison. Detects insertions/deletions.
    HashWindow = 1,
    /// Full buffer with LCS. Semantic reordering for small arrays only.
    Full = 2,
}

impl ArrayDiffMode {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(ArrayDiffMode::Index),
            1 => Some(ArrayDiffMode::HashWindow),
            2 => Some(ArrayDiffMode::Full),
            _ => None,
        }
    }
}

/// Engine configuration with explicit capability limits.
///
/// All limits are enforced with hard failure (no silent truncation).
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Maximum memory for result arena (bytes). Default: 32MB.
    pub max_memory_bytes: u32,

    /// Maximum total input size (left + right). Default: 64MB.
    pub max_input_size: u32,

    /// Maximum object keys to buffer for late-arriving key handling.
    /// Default: 100,000. Prevents unbounded memory from adversarial input.
    pub max_object_keys: u32,

    /// Array diff strategy.
    pub array_diff_mode: ArrayDiffMode,

    /// Hash window size for HashWindow mode. Default: 64.
    pub hash_window_size: u16,

    /// Maximum array size for Full mode. Larger arrays fall back to Index.
    pub max_full_array_size: u32,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            max_memory_bytes: 32 * 1024 * 1024,      // 32MB
            max_input_size: 64 * 1024 * 1024,        // 64MB
            max_object_keys: 100_000,
            array_diff_mode: ArrayDiffMode::Index,
            hash_window_size: 64,
            max_full_array_size: 1024,
        }
    }
}

impl EngineConfig {
    /// Create config optimized for edge runtimes (lower memory limits).
    pub fn edge() -> Self {
        Self {
            max_memory_bytes: 16 * 1024 * 1024,      // 16MB
            max_input_size: 32 * 1024 * 1024,        // 32MB
            max_object_keys: 50_000,
            array_diff_mode: ArrayDiffMode::Index,
            hash_window_size: 32,
            max_full_array_size: 512,
        }
    }

    /// Parse configuration from binary format.
    ///
    /// Format (little-endian):
    /// ```text
    /// [u32 max_memory_bytes]
    /// [u32 max_input_size]
    /// [u32 max_object_keys]
    /// [u8  array_diff_mode]
    /// [u16 hash_window_size]
    /// [u32 max_full_array_size]
    /// ```
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ConfigError> {
        if bytes.len() < 19 {
            return Err(ConfigError::TooShort);
        }

        let max_memory_bytes = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let max_input_size = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
        let max_object_keys = u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]);
        let array_diff_mode = ArrayDiffMode::from_u8(bytes[12])
            .ok_or(ConfigError::InvalidArrayMode)?;
        let hash_window_size = u16::from_le_bytes([bytes[13], bytes[14]]);
        let max_full_array_size = u32::from_le_bytes([bytes[15], bytes[16], bytes[17], bytes[18]]);

        // Validate bounds
        if max_memory_bytes == 0 || max_input_size == 0 {
            return Err(ConfigError::InvalidLimits);
        }

        if hash_window_size == 0 {
            return Err(ConfigError::InvalidWindowSize);
        }

        Ok(Self {
            max_memory_bytes,
            max_input_size,
            max_object_keys,
            array_diff_mode,
            hash_window_size,
            max_full_array_size,
        })
    }

    /// Serialize configuration to binary format.
    pub fn to_bytes(&self) -> [u8; 19] {
        let mut buf = [0u8; 19];
        buf[0..4].copy_from_slice(&self.max_memory_bytes.to_le_bytes());
        buf[4..8].copy_from_slice(&self.max_input_size.to_le_bytes());
        buf[8..12].copy_from_slice(&self.max_object_keys.to_le_bytes());
        buf[12] = self.array_diff_mode as u8;
        buf[13..15].copy_from_slice(&self.hash_window_size.to_le_bytes());
        buf[15..19].copy_from_slice(&self.max_full_array_size.to_le_bytes());
        buf
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigError {
    TooShort,
    InvalidArrayMode,
    InvalidLimits,
    InvalidWindowSize,
}
