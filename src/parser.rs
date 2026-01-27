//! Silicon Path Industrial SAX Parser
//! 
//! Optimized for 1GB/s+ throughput via zero-allocation rolling path hashes
//! and SIMD structural indexing.

use crate::path::{PathId, ROOT_PATH_ID, fold_segment_hash, fold_index_hash};
use core::arch::wasm32::*;

#[derive(Debug, Clone, PartialEq)]
pub enum ParseError {
    UnexpectedByte(u8),
    IncompleteInput,
    ObjectKeyLimitExceeded,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum CompactEvent {
    StartObject = 0,
    EndObject = 1,
    StartArray = 2,
    EndArray = 3,
    Value = 4, 
}

#[derive(Debug, Clone, Copy)]
pub struct CompactToken {
    pub path_id: PathId,
    pub event: CompactEvent,
    pub value_hash: u64,
    pub raw_offset: u32,
    pub raw_len: u32,
}

pub struct CompactParser {
    tokens: Vec<CompactToken>,
    current_path_id: PathId,
    path_stack: Vec<PathId>,
    array_indices: Vec<usize>,
    expecting_key: bool,
    max_object_keys: u32,
    key_count: u32,
    total_bytes: u32,
}

impl CompactParser {
    pub fn new(max_object_keys: u32, mode: crate::config::ComputeMode) -> Self {
        let token_cap = match mode {
            crate::config::ComputeMode::Throughput => 1_048_576,
            _ => 131_072,
        };

        Self {
            tokens: Vec::with_capacity(token_cap),
            current_path_id: ROOT_PATH_ID,
            path_stack: Vec::with_capacity(128),
            array_indices: Vec::with_capacity(128),
            expecting_key: false,
            max_object_keys,
            key_count: 0,
            total_bytes: 0,
        }
    }

    pub fn set_chunk_base(&mut self, _offset: u32) { }

    /// Silicon Path Dispatcher: Processes structural index positions only.
    #[inline(never)]
    pub fn parse_with_index(
        &mut self, 
        json: &[u8], 
        index: &crate::simd_index::StructuralIndex,
    ) -> Result<(), ParseError> {
        if json.is_empty() || index.positions.is_empty() { return Ok(()); }
        
        let mut i = 0;
        let positions = &index.positions;
        let len = positions.len();
        
        while i < len {
            let pos = positions[i] as usize;
            let b = unsafe { *json.get_unchecked(pos) };
            
            match b {
                b'{' => {
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartObject, 0, 0, 0);
                    self.expecting_key = true;
                    self.key_count = 0;
                    i += 1;
                }
                b'}' => {
                    self.expecting_key = false;
                    self.current_path_id = self.path_stack.pop().unwrap_or(ROOT_PATH_ID);
                    self.push_token(self.current_path_id, CompactEvent::EndObject, 0, 0, 0);
                    i += 1;
                }
                b'[' => {
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartArray, 0, 0, 0);
                    self.array_indices.push(0);
                    self.current_path_id = fold_index_hash(self.current_path_id, 0);
                    i += 1;
                }
                b']' => {
                    self.array_indices.pop();
                    self.current_path_id = self.path_stack.pop().unwrap_or(ROOT_PATH_ID);
                    self.push_token(self.current_path_id, CompactEvent::EndArray, 0, 0, 0);
                    i += 1;
                }
                b'"' => {
                    let start = pos + 1;
                    i += 1;
                    
                    // Fast skip to closing quote
                    while i < len {
                        let next_pos = positions[i] as usize;
                        if unsafe { *json.get_unchecked(next_pos) } == b'"' {
                            let s_bytes = unsafe { json.get_unchecked(start..next_pos) };
                            
                            if self.expecting_key {
                                let parent = *self.path_stack.last().unwrap_or(&ROOT_PATH_ID);
                                self.current_path_id = fold_segment_hash(parent, s_bytes);
                            } else {
                                self.push_token(
                                    self.current_path_id, 
                                    CompactEvent::Value, 
                                    hash_bytes_simd(s_bytes), 
                                    start as u32, 
                                    (next_pos - start) as u32
                                );
                            }
                            i += 1;
                            break;
                        }
                        i += 1;
                    }
                }
                b':' => {
                    self.expecting_key = false;
                    i += 1;
                }
                b',' => {
                    if let Some(idx) = self.array_indices.last_mut() {
                        *idx += 1;
                        let parent = *self.path_stack.last().unwrap_or(&ROOT_PATH_ID);
                        self.current_path_id = fold_index_hash(parent, *idx);
                    } else {
                        self.expecting_key = true;
                    }
                    i += 1;
                }
                _ => { i += 1; }
            }
        }
        
        self.total_bytes = self.total_bytes.saturating_add(json.len() as u32);
        Ok(())
    }

    pub fn clear(&mut self) {
        self.tokens.clear();
        self.current_path_id = ROOT_PATH_ID;
        self.path_stack.clear();
        self.array_indices.clear();
        self.expecting_key = false;
        self.key_count = 0;
        self.total_bytes = 0;
    }

    #[inline(always)]
    fn push_token(&mut self, path_id: PathId, event: CompactEvent, hash: u64, offset: u32, len: u32) {
        self.tokens.push(CompactToken { path_id, event, value_hash: hash, raw_offset: offset, raw_len: len });
    }

    pub fn total_bytes(&self) -> u32 { self.total_bytes }
    pub fn tokens(&self) -> &[CompactToken] { &self.tokens }
}

/// SIMD-accelerated value hash for world-class throughput.
#[inline(always)]
pub fn hash_bytes_simd(bytes: &[u8]) -> u64 {
    if bytes.len() >= 16 {
        let len = bytes.len();
        let mut ptr = bytes.as_ptr();
        let end = unsafe { ptr.add(len & !15) };
        
        let mut acc = unsafe { v128_load(ptr as *const v128) };
        ptr = unsafe { ptr.add(16) };
        
        while ptr < end {
            let chunk = unsafe { v128_load(ptr as *const v128) };
            acc = v128_xor(acc, chunk);
            ptr = unsafe { ptr.add(16) };
        }
        
        let lanes = [
            u64x2_extract_lane::<0>(acc),
            u64x2_extract_lane::<1>(acc)
        ];
        let mut hash = lanes[0] ^ lanes[1] ^ (len as u64);
        
        // Tail
        for &b in &bytes[len & !15..] {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash
    } else {
        use std::hash::Hasher;
        let mut h = rustc_hash::FxHasher::default();
        h.write(bytes);
        h.finish()
    }
}
