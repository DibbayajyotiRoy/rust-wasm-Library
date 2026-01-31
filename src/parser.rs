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
        let json_len = json.len();
        
        // Track if we just saw a colon (expecting a value)
        let mut after_colon = false;
        
        while i < len {
            let pos = positions[i] as usize;
            let b = unsafe { *json.get_unchecked(pos) };
            
            match b {
                b'{' => {
                    after_colon = false;
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartObject, 0, 0, 0);
                    self.expecting_key = true;
                    self.key_count = 0;
                    i += 1;
                }
                b'}' => {
                    after_colon = false;
                    self.expecting_key = false;
                    self.current_path_id = self.path_stack.pop().unwrap_or(ROOT_PATH_ID);
                    self.push_token(self.current_path_id, CompactEvent::EndObject, 0, 0, 0);
                    i += 1;
                }
                b'[' => {
                    after_colon = false;
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartArray, 0, 0, 0);
                    self.array_indices.push(0);
                    self.current_path_id = fold_index_hash(self.current_path_id, 0);
                    i += 1;
                    
                    // Check for primitive value as first array element
                    if i < len {
                        let next_struct_pos = positions[i] as usize;
                        let value_start = skip_whitespace(json, pos + 1, next_struct_pos);
                        if value_start < next_struct_pos {
                            let first_char = unsafe { *json.get_unchecked(value_start) };
                            if !matches!(first_char, b'"' | b'{' | b'[' | b']') {
                                let value_end = find_primitive_end(json, value_start, next_struct_pos);
                                if value_end > value_start {
                                    let val_bytes = unsafe { json.get_unchecked(value_start..value_end) };
                                    self.push_token(
                                        self.current_path_id,
                                        CompactEvent::Value,
                                        hash_bytes_simd(val_bytes),
                                        value_start as u32,
                                        (value_end - value_start) as u32
                                    );
                                }
                            }
                        }
                    }
                }
                b']' => {
                    // Check for last primitive value before closing bracket
                    if i > 0 && !self.array_indices.is_empty() {
                        let prev_pos = positions[i - 1] as usize + 1;
                        let value_start = skip_whitespace(json, prev_pos, pos);
                        if value_start < pos {
                            let first_char = unsafe { *json.get_unchecked(value_start) };
                            if !matches!(first_char, b'"' | b'{' | b'[' | b'}' | b']' | b',') {
                                let value_end = find_primitive_end(json, value_start, pos);
                                if value_end > value_start {
                                    let val_bytes = unsafe { json.get_unchecked(value_start..value_end) };
                                    self.push_token(
                                        self.current_path_id,
                                        CompactEvent::Value,
                                        hash_bytes_simd(val_bytes),
                                        value_start as u32,
                                        (value_end - value_start) as u32
                                    );
                                }
                            }
                        }
                    }
                    
                    after_colon = false;
                    self.array_indices.pop();
                    self.current_path_id = self.path_stack.pop().unwrap_or(ROOT_PATH_ID);
                    self.push_token(self.current_path_id, CompactEvent::EndArray, 0, 0, 0);
                    i += 1;
                }
                b'"' => {
                    after_colon = false;
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
                    after_colon = true;
                    i += 1;
                    
                    // Check if next structural char indicates a primitive value
                    // Look ahead to see what follows the colon
                    if i < len {
                        let next_struct_pos = positions[i] as usize;
                        // Scan from pos+1 to next_struct_pos for primitive value
                        let value_start = skip_whitespace(json, pos + 1, next_struct_pos);
                        if value_start < next_struct_pos {
                            let first_char = unsafe { *json.get_unchecked(value_start) };
                            // If it's not a quote or structural char, it's a primitive
                            if !matches!(first_char, b'"' | b'{' | b'[') {
                                // Find end of primitive (up to next structural char)
                                let value_end = find_primitive_end(json, value_start, next_struct_pos);
                                if value_end > value_start {
                                    let val_bytes = unsafe { json.get_unchecked(value_start..value_end) };
                                    self.push_token(
                                        self.current_path_id,
                                        CompactEvent::Value,
                                        hash_bytes_simd(val_bytes),
                                        value_start as u32,
                                        (value_end - value_start) as u32
                                    );
                                }
                            }
                        }
                    }
                }
                b',' => {
                    // Check if we're in array context
                    let in_array = !self.array_indices.is_empty();
                    
                    if in_array {
                        // Check if there's a primitive value before this comma (array element)
                        if i > 0 && !after_colon {
                            let prev_pos = positions[i - 1] as usize + 1;
                            let value_start = skip_whitespace(json, prev_pos, pos);
                            if value_start < pos {
                                let first_char = unsafe { *json.get_unchecked(value_start) };
                                if !matches!(first_char, b'"' | b'{' | b'[' | b'}' | b']') {
                                    let value_end = find_primitive_end(json, value_start, pos);
                                    if value_end > value_start {
                                        let val_bytes = unsafe { json.get_unchecked(value_start..value_end) };
                                        self.push_token(
                                            self.current_path_id,
                                            CompactEvent::Value,
                                            hash_bytes_simd(val_bytes),
                                            value_start as u32,
                                            (value_end - value_start) as u32
                                        );
                                    }
                                }
                            }
                        }
                        
                        // Increment array index
                        if let Some(idx) = self.array_indices.last_mut() {
                            *idx += 1;
                        }
                        let parent = *self.path_stack.last().unwrap_or(&ROOT_PATH_ID);
                        let new_idx = *self.array_indices.last().unwrap_or(&0);
                        self.current_path_id = fold_index_hash(parent, new_idx);
                    } else {
                        self.expecting_key = true;
                    }
                    after_colon = false;
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

/// Skip whitespace characters (standalone function)
#[inline(always)]
fn skip_whitespace(json: &[u8], start: usize, end: usize) -> usize {
    let mut pos = start;
    while pos < end {
        let b = unsafe { *json.get_unchecked(pos) };
        if !matches!(b, b' ' | b'\t' | b'\n' | b'\r') {
            break;
        }
        pos += 1;
    }
    pos
}

/// Find end of primitive value (number, true, false, null) - standalone function
#[inline(always)]
fn find_primitive_end(json: &[u8], start: usize, max_end: usize) -> usize {
    let mut pos = start;
    while pos < max_end {
        let b = unsafe { *json.get_unchecked(pos) };
        // Primitive ends at whitespace or structural char
        if matches!(b, b' ' | b'\t' | b'\n' | b'\r' | b',' | b'}' | b']') {
            break;
        }
        pos += 1;
    }
    pos
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
