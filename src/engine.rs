//! Main engine using optimized CompactParser.

use crate::config::EngineConfig;
use crate::diff::{compute_compact_diff, DiffOp};
use crate::error::{EngineError, ErrorBuffer};
use crate::memory::ResultArena;
use crate::parser::CompactParser;
use crate::status::Status;

pub struct Engine {
    magic: u32,
    arena: ResultArena,
    path_arena: crate::path::PathArena,
    left_parser: CompactParser,
    right_parser: CompactParser,
    error: ErrorBuffer,
    sealed: bool,
    max_input_size: u32,
    symbol_buffer: String,
}

impl Engine {
    pub fn new(config: EngineConfig, magic: u32) -> Result<Self, EngineError> {
        Ok(Self {
            magic,
            arena: ResultArena::new(config.max_memory_bytes),
            path_arena: crate::path::PathArena::new(config.compute_mode),
            left_parser: CompactParser::new(config.max_object_keys, config.compute_mode),
            right_parser: CompactParser::new(config.max_object_keys, config.compute_mode),
            error: ErrorBuffer::new(),
            sealed: false,
            max_input_size: config.max_input_size,
            symbol_buffer: String::with_capacity(256),
        })
    }

    pub fn magic(&self) -> u32 { self.magic }
    pub fn clear_magic(&mut self) { self.magic = 0; }

    pub fn push_left(&mut self, chunk: &[u8]) -> Status {
        if self.sealed { return Status::EngineSealed; }
        if self.left_parser.total_bytes() + self.right_parser.total_bytes() + chunk.len() as u32 > self.max_input_size {
            return Status::InputLimitExceeded;
        }
        match self.left_parser.parse(chunk, &mut self.path_arena) {
            Ok(_) => Status::Ok,
            Err(crate::parser::ParseError::ObjectKeyLimitExceeded) => Status::ObjectKeyLimitExceeded,
            Err(_) => Status::Error,
        }
    }

    pub fn push_right(&mut self, chunk: &[u8]) -> Status {
        if self.sealed { return Status::EngineSealed; }
        if self.left_parser.total_bytes() + self.right_parser.total_bytes() + chunk.len() as u32 > self.max_input_size {
            return Status::InputLimitExceeded;
        }
        match self.right_parser.parse(chunk, &mut self.path_arena) {
            Ok(_) => Status::Ok,
            Err(crate::parser::ParseError::ObjectKeyLimitExceeded) => Status::ObjectKeyLimitExceeded,
            Err(_) => Status::Error,
        }
    }

    pub fn finalize(&mut self) -> Result<*const u8, EngineError> {
        if self.sealed { return Err(EngineError::EngineSealed); }
        self.sealed = true;

        let diffs = compute_compact_diff(&self.left_parser, &self.right_parser);
        
        for d in diffs {
            if let Err(_) = self.arena.write_entry_v2(
                unsafe { std::mem::transmute(d.op) },
                d.path_id,
                d.left_val,
                d.right_val,
            ) {
                self.set_error(EngineError::MemoryLimitExceeded);
                break;
            }
        }

        self.arena.seal();
        Ok(self.arena.as_ptr())
    }

    pub fn clear(&mut self) {
        self.arena.clear();
        self.path_arena.clear();
        self.left_parser.clear();
        self.right_parser.clear();
        self.sealed = false;
        self.symbol_buffer.clear();
    }

    pub fn resolve_symbol(&mut self, path_id: crate::path::PathId) -> (*const u8, u32) {
        self.symbol_buffer = self.path_arena.path_to_string(path_id);
        (self.symbol_buffer.as_ptr(), self.symbol_buffer.len() as u32)
    }

    pub fn symbol_buffer_len(&self) -> u32 { self.symbol_buffer.len() as u32 }

    pub fn result_len(&self) -> u32 { self.arena.len() }
    pub fn last_error_ptr(&self) -> *const u8 { self.error.as_ptr() }
    pub fn last_error_len(&self) -> u32 { self.error.len() }

    fn set_error(&mut self, error: EngineError) {
        self.error.set(&error);
    }
}
