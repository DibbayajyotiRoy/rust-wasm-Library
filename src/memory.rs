//! Arena-based memory management for diff results.
//!
//! Memory layout guarantees:
//! - All returned offsets are 8-byte aligned
//! - Result arena never overlaps input buffers
//! - Arena allocation is monotonic (no dealloc until destroy)
//! - finalize() seals arena — any push after returns EngineSealed

use crate::diff::DiffOp;
use crate::path::{SegmentId, SegmentKind, PathInterner};
use std::fmt::Write;

/// Binary output format version.
/// Using semantic versioning: major.minor as u16.u16
/// v2.0: Symbol-based output (PathId + Raw Offsets)
pub const FORMAT_VERSION_MAJOR: u16 = 2;
pub const FORMAT_VERSION_MINOR: u16 = 0;

/// Result arena for diff output.
///
/// Allocates in fixed blocks to avoid unpredictable growth.
pub struct ResultArena {
    /// The result buffer
    buffer: Vec<u8>,
    /// Maximum allowed size
    max_size: usize,
    /// Whether the arena is sealed (no more writes)
    sealed: bool,
    /// Number of entries written
    entry_count: u32,
    /// Offset where entry data starts (after header)
    data_offset: usize,
}

impl ResultArena {
    /// Create a new result arena with the given maximum size.
    pub fn new(max_size: u32) -> Self {
        // Header v2 (16 bytes): 
        // [u16 major][u16 minor][u32 entry_count][u64 total_len]
        let mut buffer = Vec::with_capacity(16);
        buffer.extend_from_slice(&FORMAT_VERSION_MAJOR.to_le_bytes());
        buffer.extend_from_slice(&FORMAT_VERSION_MINOR.to_le_bytes());
        buffer.extend_from_slice(&0u32.to_le_bytes()); // entry count
        buffer.extend_from_slice(&0u64.to_le_bytes()); // total len

        Self {
            buffer,
            max_size: max_size as usize,
            sealed: false,
            entry_count: 0,
            data_offset: 16,
        }
    }

    /// Check if adding `size` bytes would exceed the limit.
    pub fn would_exceed(&self, size: usize) -> bool {
        self.buffer.len() + size > self.max_size
    }

    /// Seal the arena. No more writes allowed after this.
    pub fn seal(&mut self) {
        // Update entry count (offset 4) and total len (offset 8) in header
        let count_bytes = self.entry_count.to_le_bytes();
        self.buffer[4..8].copy_from_slice(&count_bytes);

        let total_len = self.buffer.len() as u64;
        self.buffer[8..16].copy_from_slice(&total_len.to_le_bytes());

        self.sealed = true;
    }

    /// Reset the arena for reuse without re-allocating.
    pub fn clear(&mut self) {
        self.buffer.truncate(8); // Keep version and entry count placeholder
        self.buffer[4..8].copy_from_slice(&0u32.to_le_bytes());
        self.sealed = false;
        self.entry_count = 0;
    }

    /// Check if the arena is sealed.
    pub fn is_sealed(&self) -> bool {
        self.sealed
    }

    pub fn write_entry_raw(
        &mut self,
        op: DiffOp,
        path_str: &str,
        left: Option<&[u8]>,
        right: Option<&[u8]>,
    ) -> Result<(), ArenaError> {
        if self.sealed {
            return Err(ArenaError::Sealed);
        }

        let path_bytes = path_str.as_bytes();
        let left_bytes = left.unwrap_or(&[]);
        let right_bytes = right.unwrap_or(&[]);

        // Calculate entry size with 8-byte alignment padding
        let entry_size = 1  // op
            + 4  // path_len
            + path_bytes.len()
            + 4  // left_len
            + left_bytes.len()
            + 4  // right_len
            + right_bytes.len();
        
        let aligned_size = (entry_size + 7) & !7; // 8-byte alignment

        if self.would_exceed(aligned_size) {
            return Err(ArenaError::LimitExceeded);
        }

        // Write entry
        self.buffer.push(op as u8);
        self.buffer.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
        self.buffer.extend_from_slice(path_bytes);
        self.buffer.extend_from_slice(&(left_bytes.len() as u32).to_le_bytes());
        self.buffer.extend_from_slice(left_bytes);
        self.buffer.extend_from_slice(&(right_bytes.len() as u32).to_le_bytes());
        self.buffer.extend_from_slice(right_bytes);

        // Pad to 8-byte alignment
        let padding = aligned_size - entry_size;
        for _ in 0..padding {
            self.buffer.push(0);
        }

        self.entry_count += 1;
        Ok(())
    }

    pub fn write_entry_v2(
        &mut self,
        op: DiffOp,
        path_id: crate::path::PathId,
        left_val: (u32, u32),
        right_val: (u32, u32),
    ) -> Result<(), ArenaError> {
        if self.sealed { return Err(ArenaError::Sealed); }

        // Entry format v2: 24 bytes (8-aligned)
        // [u8 op][u32 path_id][u32 l_off][u32 l_len][u32 r_off][u32 r_len][u8 padding x3]
        let _entry_size = 21;
        let aligned_size = 24;

        if self.would_exceed(aligned_size) {
            return Err(ArenaError::LimitExceeded);
        }

        self.buffer.push(op as u8);
        self.buffer.extend_from_slice(&path_id.0.to_le_bytes());
        self.buffer.extend_from_slice(&left_val.0.to_le_bytes());
        self.buffer.extend_from_slice(&left_val.1.to_le_bytes());
        self.buffer.extend_from_slice(&right_val.0.to_le_bytes());
        self.buffer.extend_from_slice(&right_val.1.to_le_bytes());
        
        // Padded to 24 bytes
        self.buffer.push(0);
        self.buffer.push(0);
        self.buffer.push(0);

        self.entry_count += 1;
        Ok(())
    }

    /// Get pointer to the result buffer.
    pub fn as_ptr(&self) -> *const u8 {
        self.buffer.as_ptr()
    }

    /// Get the length of the result buffer.
    pub fn len(&self) -> u32 {
        self.buffer.len() as u32
    }

    /// Check if the arena is empty (no entries).
    pub fn is_empty(&self) -> bool {
        self.entry_count == 0
    }

    /// Get the number of entries.
    pub fn entry_count(&self) -> u32 {
        self.entry_count
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArenaError {
    Sealed,
    LimitExceeded,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path::PathInterner;

    #[test]
    fn test_arena_versioning() {
        let arena = ResultArena::new(1024);
        let buffer = unsafe { std::slice::from_raw_parts(arena.as_ptr(), arena.len() as usize) };
        
        let major = u16::from_le_bytes([buffer[0], buffer[1]]);
        let minor = u16::from_le_bytes([buffer[2], buffer[3]]);
        
        assert_eq!(major, FORMAT_VERSION_MAJOR);
        assert_eq!(minor, FORMAT_VERSION_MINOR);
    }

    #[test]
    fn test_arena_sealing() {
        let mut arena = ResultArena::new(1024);
        let interner = PathInterner::new();
        let path = JsonPath::new();
        
        // Should succeed before sealing
        assert!(arena.write_entry(DiffOp::Added, &path, &interner, None, Some(b"test")).is_ok());
        
        // Seal
        arena.seal();
        
        // Should fail after sealing
        assert_eq!(
            arena.write_entry(DiffOp::Added, &path, &interner, None, Some(b"test")),
            Err(ArenaError::Sealed)
        );
    }
}
