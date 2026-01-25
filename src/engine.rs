//! Main engine using optimized CompactParser.

use crate::config::EngineConfig;
use crate::diff::{compute_compact_diff, DiffOp};
use crate::error::{EngineError, ErrorBuffer};
use crate::memory::ResultArena;
use crate::parser::CompactParser;
use crate::status::Status;

pub struct Engine {
    magic: u32,
    config: EngineConfig,
    arena: ResultArena,
    path_arena: crate::path::PathArena,
    left_parser: CompactParser,
    right_parser: CompactParser,
    error: ErrorBuffer,
    sealed: bool,
}

impl Engine {
    pub fn new(config: EngineConfig, magic: u32) -> Result<Self, EngineError> {
        Ok(Self {
            magic,
            config: config.clone(),
            arena: ResultArena::new(config.max_memory_bytes),
            path_arena: crate::path::PathArena::new(),
            left_parser: CompactParser::new(config.max_object_keys),
            right_parser: CompactParser::new(config.max_object_keys),
            error: ErrorBuffer::new(),
            sealed: false,
        })
    }

    pub fn magic(&self) -> u32 { self.magic }
    pub fn clear_magic(&mut self) { self.magic = 0; }

    pub fn push_left(&mut self, chunk: &[u8]) -> Status {
        if self.sealed { return Status::EngineSealed; }
        match self.left_parser.parse(chunk, &mut self.path_arena) {
            Ok(_) => Status::Ok,
            Err(crate::parser::ParseError::ObjectKeyLimitExceeded) => Status::ObjectKeyLimitExceeded,
            Err(_) => Status::Error,
        }
    }

    pub fn push_right(&mut self, chunk: &[u8]) -> Status {
        if self.sealed { return Status::EngineSealed; }
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
            let path_str = self.path_arena.path_to_string(d.path_id);
            let left_v = if d.left_val.1 > 0 {
                Some(&self.left_parser.raw_values()[d.left_val.0 as usize..(d.left_val.0 + d.left_val.1) as usize])
            } else { None };
            let right_v = if d.right_val.1 > 0 {
                Some(&self.right_parser.raw_values()[d.right_val.0 as usize..(d.right_val.0 + d.right_val.1) as usize])
            } else { None };

            if let Err(_) = self.arena.write_entry_raw(
                unsafe { std::mem::transmute(d.op) },
                &path_str,
                left_v,
                right_v,
            ) {
                self.set_error(EngineError::MemoryLimitExceeded);
                break;
            }
        }

        self.arena.seal();
        Ok(self.arena.as_ptr())
    }

    pub fn result_len(&self) -> u32 { self.arena.len() }
    pub fn last_error_ptr(&self) -> *const u8 { self.error.as_ptr() }
    pub fn last_error_len(&self) -> u32 { self.error.len() }

    fn set_error(&mut self, error: EngineError) {
        self.error.set(&error);
    }
}
