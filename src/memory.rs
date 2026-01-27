//! Arena-based memory management for diff results.
//!
//! Memory layout v2.1: Packed 8-byte aligned symbolic entries.

use crate::diff::DiffOp;

pub const FORMAT_VERSION_MAJOR: u16 = 2;
pub const FORMAT_VERSION_MINOR: u16 = 1;

pub struct ResultArena {
    buffer: Vec<u8>,
    max_size: usize,
    sealed: bool,
    entry_count: u32,
}

impl ResultArena {
    pub fn new(max_size: u32) -> Self {
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
        }
    }

    pub fn seal(&mut self) {
        let count_bytes = self.entry_count.to_le_bytes();
        self.buffer[4..8].copy_from_slice(&count_bytes);
        let total_len = self.buffer.len() as u64;
        self.buffer[8..16].copy_from_slice(&total_len.to_le_bytes());
        self.sealed = true;
    }

    pub fn clear(&mut self) {
        self.buffer.truncate(16);
        self.buffer[4..8].copy_from_slice(&0u32.to_le_bytes());
        self.buffer[8..16].copy_from_slice(&0u64.to_le_bytes());
        self.sealed = false;
        self.entry_count = 0;
    }

    pub fn write_entry_v2(
        &mut self,
        op: DiffOp,
        path_id: crate::path::PathId,
        left_val: Option<(u32, u32)>,
        right_val: Option<(u32, u32)>,
    ) -> Result<(), ArenaError> {
        if self.sealed { return Err(ArenaError::Sealed); }

        // Entry format v2.1: 24 bytes (fixed size, 8-aligned)
        const ENTRY_SIZE: usize = 24;
        if self.buffer.len() + ENTRY_SIZE > self.max_size {
            return Err(ArenaError::LimitExceeded);
        }

        let (lo, ll) = left_val.unwrap_or((0, 0));
        let (ro, rl) = right_val.unwrap_or((0, 0));

        // Single bulk write (24 bytes) - much faster than 7 separate calls
        let mut entry = [0u8; ENTRY_SIZE];
        entry[0] = op as u8;
        entry[1..5].copy_from_slice(&path_id.0.to_le_bytes());
        entry[5..9].copy_from_slice(&lo.to_le_bytes());
        entry[9..13].copy_from_slice(&ll.to_le_bytes());
        entry[13..17].copy_from_slice(&ro.to_le_bytes());
        entry[17..21].copy_from_slice(&rl.to_le_bytes());
        // entry[21..24] already zero (padding)
        self.buffer.extend_from_slice(&entry);

        self.entry_count += 1;
        Ok(())
    }

    pub fn as_ptr(&self) -> *const u8 { self.buffer.as_ptr() }
    pub fn len(&self) -> u32 { self.buffer.len() as u32 }
    pub fn entry_count(&self) -> u32 { self.entry_count }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArenaError {
    Sealed,
    LimitExceeded,
}
