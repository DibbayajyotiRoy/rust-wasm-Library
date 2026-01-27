//! SIMD-accelerated Stage 1 structural indexing (simdjson-style)
//!
//! This module provides a fast structural index of JSON documents by
//! finding all structural characters ({, }, [, ], :, ,, ") in parallel
//! using SIMD operations.

use core::arch::wasm32::*;

/// Structural index: positions of all structural characters
pub struct StructuralIndex {
    /// Positions of structural characters in the input
    pub positions: Vec<u32>,
    /// Total bytes processed
    pub len: u32,
}

impl StructuralIndex {
    pub fn new() -> Self {
        Self {
            positions: Vec::with_capacity(65536),
            len: 0,
        }
    }

    pub fn clear(&mut self) {
        self.positions.clear();
        self.len = 0;
    }

    /// Build structural index using SIMD
    /// This is Stage 1 of simdjson-style parsing
    #[inline(never)]
    pub fn build(&mut self, json: &[u8]) {
        self.clear();
        self.len = json.len() as u32;
        
        if json.is_empty() { return; }
        
        let mut pos: u32 = 0;
        let len = json.len();
        let ptr = json.as_ptr();
        
        // Process 64 bytes at a time (4 x 16-byte SIMD registers)
        let chunks = len / 64;
        
        for _ in 0..chunks {
            let base = pos;
            
            // Load 4 chunks
            let c0 = unsafe { v128_load(ptr.add(pos as usize) as *const v128) };
            let c1 = unsafe { v128_load(ptr.add(pos as usize + 16) as *const v128) };
            let c2 = unsafe { v128_load(ptr.add(pos as usize + 32) as *const v128) };
            let c3 = unsafe { v128_load(ptr.add(pos as usize + 48) as *const v128) };
            
            // Find structural characters: { } [ ] : , "
            // Check each character type across all 4 chunks
            let brace_open = i8x16_splat(b'{' as i8);
            let brace_close = i8x16_splat(b'}' as i8);
            let bracket_open = i8x16_splat(b'[' as i8);
            let bracket_close = i8x16_splat(b']' as i8);
            let colon = i8x16_splat(b':' as i8);
            let comma = i8x16_splat(b',' as i8);
            let quote = i8x16_splat(b'"' as i8);
            
            // Combine all structural character matches for each chunk
            macro_rules! find_structural {
                ($chunk:expr) => {{
                    let m1 = v128_or(u8x16_eq($chunk, brace_open), u8x16_eq($chunk, brace_close));
                    let m2 = v128_or(u8x16_eq($chunk, bracket_open), u8x16_eq($chunk, bracket_close));
                    let m3 = v128_or(u8x16_eq($chunk, colon), u8x16_eq($chunk, comma));
                    let m4 = u8x16_eq($chunk, quote);
                    v128_or(v128_or(m1, m2), v128_or(m3, m4))
                }};
            }
            
            let mask0 = i8x16_bitmask(find_structural!(c0)) as u64;
            let mask1 = i8x16_bitmask(find_structural!(c1)) as u64;
            let mask2 = i8x16_bitmask(find_structural!(c2)) as u64;
            let mask3 = i8x16_bitmask(find_structural!(c3)) as u64;
            
            // Combine into 64-bit mask
            let combined = mask0 | (mask1 << 16) | (mask2 << 32) | (mask3 << 48);
            
            // Extract positions of set bits
            if combined != 0 {
                self.extract_positions(combined, base);
            }
            
            pos += 64;
        }
        
        // Handle remainder (< 64 bytes)
        while (pos as usize) < len {
            let b = json[pos as usize];
            if matches!(b, b'{' | b'}' | b'[' | b']' | b':' | b',' | b'"') {
                self.positions.push(pos);
            }
            pos += 1;
        }
    }
    
    #[inline(always)]
    fn extract_positions(&mut self, mut mask: u64, base: u32) {
        while mask != 0 {
            let bit_pos = mask.trailing_zeros();
            self.positions.push(base + bit_pos);
            mask &= mask - 1; // Clear lowest set bit
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_structural_index() {
        let json = br#"{"a":1,"b":[2,3]}"#;
        let mut idx = StructuralIndex::new();
        idx.build(json);
        // Should find: { " : " , " : [ , ] }
        assert!(idx.positions.len() > 0);
    }
}
