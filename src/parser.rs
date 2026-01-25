//! Compact, arena-based SAX parser.
//!
//! Minimizes heap allocations by using PathId and a raw value buffer.

use crate::path::{PathArena, PathId, SegmentId};

#[derive(Debug, Clone, PartialEq)]
pub enum ParseError {
    UnexpectedByte(u8),
    IncompleteInput,
    InvalidEscape(u8),
    InvalidUnicodeEscape,
    InvalidBoolean,
    InvalidNull,
    InvalidNumber,
    ObjectKeyLimitExceeded,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CompactEvent {
    StartObject,
    EndObject,
    StartArray,
    EndArray,
    Value, // All leaf values (Null, Bool, Num, String)
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
    raw_values: Vec<u8>,
    current_path_id: PathId,
    path_stack: Vec<PathId>,
    array_indices: Vec<usize>,
    expecting_key: bool,
    max_object_keys: u32,
    key_count: u32,
}

impl CompactParser {
    pub fn new(max_object_keys: u32) -> Self {
        Self {
            tokens: Vec::with_capacity(2048),
            raw_values: Vec::with_capacity(8192),
            current_path_id: crate::path::ROOT_PATH_ID,
            path_stack: Vec::with_capacity(32),
            array_indices: Vec::new(),
            expecting_key: false,
            max_object_keys,
            key_count: 0,
        }
    }

    pub fn parse(&mut self, json: &[u8], arena: &mut PathArena) -> Result<(), crate::parser::ParseError> {
        let mut pos = 0;
        let len = json.len();
        while pos < len {
            let b = json[pos];
            if b.is_ascii_whitespace() {
                pos += 1;
                continue;
            }

            match b {
                b'{' => {
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartObject, 0, 0, 0);
                    self.expecting_key = true;
                    pos += 1;
                }
                b'}' => {
                    if let Some(prev) = self.path_stack.pop() {
                        self.current_path_id = prev;
                    }
                    self.push_token(self.current_path_id, CompactEvent::EndObject, 0, 0, 0);
                    self.expecting_key = false;
                    pos += 1;
                }
                b'[' => {
                    self.path_stack.push(self.current_path_id);
                    self.push_token(self.current_path_id, CompactEvent::StartArray, 0, 0, 0);
                    self.array_indices.push(0);
                    let seg = arena.interner_mut().intern_index(0);
                    self.current_path_id = arena.get_child_path(self.current_path_id, seg);
                    pos += 1;
                }
                b']' => {
                    self.array_indices.pop();
                    if let Some(prev) = self.path_stack.pop() {
                        self.current_path_id = prev;
                    }
                    self.push_token(self.current_path_id, CompactEvent::EndArray, 0, 0, 0);
                    pos += 1;
                }
                b'"' => {
                    pos = self.parse_string(arena, json, pos)?;
                }
                b':' => {
                    self.expecting_key = false;
                    pos += 1;
                }
                b',' => {
                    if let Some(idx) = self.array_indices.last_mut() {
                        *idx += 1;
                        let last_parent = *self.path_stack.last().unwrap_or(&crate::path::ROOT_PATH_ID);
                        let seg = arena.interner_mut().intern_index(*idx);
                        self.current_path_id = arena.get_child_path(last_parent, seg);
                    } else {
                        self.expecting_key = true;
                    }
                    pos += 1;
                }
                b'-' | b'0'..=b'9' | b't' | b'f' | b'n' => {
                    pos = self.parse_primitive(arena, json, pos)?;
                    // Values pop their path if in object (keys pushed them)
                    if self.array_indices.is_empty() {
                        if let Some(&prev) = self.path_stack.last() {
                            self.current_path_id = prev;
                        }
                    }
                }
                _ => pos += 1,
            }
        }
        Ok(())
    }

    fn push_token(&mut self, path_id: PathId, event: CompactEvent, hash: u64, offset: u32, len: u32) {
        self.tokens.push(CompactToken {
            path_id,
            event,
            value_hash: hash,
            raw_offset: offset,
            raw_len: len,
        });
    }

    fn parse_string(&mut self, arena: &mut PathArena, json: &[u8], mut pos: usize) -> Result<usize, crate::parser::ParseError> {
        pos += 1; // skip "
        let start = pos;
        while pos < json.len() && json[pos] != b'"' {
            if json[pos] == b'\\' { pos += 1; }
            pos += 1;
        }
        if pos >= json.len() { return Err(crate::parser::ParseError::IncompleteInput); }
        let s_bytes = &json[start..pos];
        pos += 1; // skip "

        if self.expecting_key {
            self.key_count += 1;
            if self.key_count > self.max_object_keys {
                return Err(crate::parser::ParseError::ObjectKeyLimitExceeded);
            }
            let s = std::str::from_utf8(s_bytes).map_err(|_| crate::parser::ParseError::UnexpectedByte(0))?;
            let seg = arena.interner_mut().intern_key(s);
            let parent = *self.path_stack.last().unwrap_or(&crate::path::ROOT_PATH_ID);
            self.current_path_id = arena.get_child_path(parent, seg);
        } else {
            let hash = hash_bytes(s_bytes);
            let offset = self.raw_values.len() as u32;
            self.raw_values.push(b'"');
            self.raw_values.extend_from_slice(s_bytes);
            self.raw_values.push(b'"');
            let len = self.raw_values.len() as u32 - offset;
            self.push_token(self.current_path_id, CompactEvent::Value, hash, offset, len);
        }
        Ok(pos)
    }

    fn parse_primitive(&mut self, _arena: &mut PathArena, json: &[u8], mut pos: usize) -> Result<usize, crate::parser::ParseError> {
        let start = pos;
        while pos < json.len() && !matches!(json[pos], b',' | b'}' | b']' | b' ' | b'\t' | b'\n' | b'\r') {
            pos += 1;
        }
        let bytes = &json[start..pos];
        let hash = hash_bytes(bytes);
        let offset = self.raw_values.len() as u32;
        self.raw_values.extend_from_slice(bytes);
        let len = bytes.len() as u32;
        self.push_token(self.current_path_id, CompactEvent::Value, hash, offset, len);
        Ok(pos)
    }

    pub fn tokens(&self) -> &[CompactToken] { &self.tokens }
    pub fn raw_values(&self) -> &[u8] { &self.raw_values }
}

pub fn hash_bytes(bytes: &[u8]) -> u64 {
    use std::hash::Hasher;
    let mut h = rustc_hash::FxHasher::default();
    h.write(bytes);
    h.finish()
}
