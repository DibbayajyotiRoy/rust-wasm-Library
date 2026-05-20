use crate::memory::ResultArena;
use crate::diff::compute_compact_diff_v2;
use crate::error::{ErrorBuffer, EngineError};
use crate::parser::CompactParser;
use crate::status::Status;
use crate::config::EngineConfig;

pub struct Engine {
    magic: u32,
    arena: ResultArena,
    left_parser: CompactParser,
    right_parser: CompactParser,
    error: ErrorBuffer,
    sealed: bool,
    left_input: Vec<u8>,
    right_input: Vec<u8>,
    left_index: crate::simd_index::StructuralIndex,
    right_index: crate::simd_index::StructuralIndex,
}

impl Engine {
    pub fn new(config: EngineConfig, magic: u32) -> Result<Self, EngineError> {
        let input_cap = (config.max_input_size / 2) as usize;
        Ok(Self {
            magic,
            arena: ResultArena::new(config.max_memory_bytes),
            left_parser: CompactParser::new(config.max_object_keys, config.compute_mode),
            right_parser: CompactParser::new(config.max_object_keys, config.compute_mode),
            error: ErrorBuffer::new(),
            sealed: false,
            left_input: Vec::with_capacity(input_cap),
            right_input: Vec::with_capacity(input_cap),
            left_index: crate::simd_index::StructuralIndex::new(),
            right_index: crate::simd_index::StructuralIndex::new(),
        })
    }

    pub fn magic(&self) -> u32 { self.magic }
    pub fn clear_magic(&mut self) { self.magic = 0; }

    pub fn commit_left(&mut self, len: u32) -> Status {
        if self.sealed { return Status::EngineSealed; }
        // `len` is supplied by the host. Reading past the buffer's allocated
        // capacity would be out-of-bounds — reject instead of trusting it.
        if len as usize > self.left_input.capacity() { return Status::Error; }
        let bytes = unsafe { std::slice::from_raw_parts(self.left_input.as_ptr(), len as usize) };
        self.left_index.build(bytes);
        match self.left_parser.parse_with_index(bytes, &self.left_index) {
            Ok(_) => Status::Ok,
            Err(_) => Status::Error,
        }
    }

    pub fn commit_right(&mut self, len: u32) -> Status {
        if self.sealed { return Status::EngineSealed; }
        if len as usize > self.right_input.capacity() { return Status::Error; }
        let bytes = unsafe { std::slice::from_raw_parts(self.right_input.as_ptr(), len as usize) };
        self.right_index.build(bytes);
        match self.right_parser.parse_with_index(bytes, &self.right_index) {
            Ok(_) => Status::Ok,
            Err(_) => Status::Error,
        }
    }

    pub fn finalize(&mut self) -> Result<*const u8, EngineError> {
        if self.sealed { return Ok(self.arena.as_ptr()); }
        self.sealed = true;

        let diffs = compute_compact_diff_v2(&self.left_parser, &self.right_parser);
        
        for d in diffs {
            if let Err(_) = self.arena.write_entry_v2(
                d.op,
                d.path_id,
                d.left_val,
                d.right_val,
            ) {
                self.error.set(&EngineError::MemoryLimitExceeded);
                break;
            }
        }

        self.arena.seal();
        Ok(self.arena.as_ptr())
    }

    pub fn clear(&mut self) {
        self.arena.clear();
        self.left_parser.clear();
        self.right_parser.clear();
        self.sealed = false;
    }

    pub fn left_input_ptr(&mut self) -> *mut u8 { self.left_input.as_mut_ptr() }
    pub fn right_input_ptr(&mut self) -> *mut u8 { self.right_input.as_mut_ptr() }

    pub fn result_len(&self) -> u32 { self.arena.len() }
    pub fn last_error_len(&self) -> u32 { self.error.len() }
    pub fn last_error_ptr(&self) -> *const u8 { self.error.as_ptr() }
}
