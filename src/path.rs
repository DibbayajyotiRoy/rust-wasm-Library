//! Silicon Path: Zero-allocation rolling path hashing.
//!
//! Replaces the Trie-based PathArena for world-class throughput.

/// Path identifier using a 64-bit non-cryptographic hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PathId(pub u64);

pub const ROOT_PATH_ID: PathId = PathId(0);

/// Rolling hash generator for path segments.
#[inline(always)]
pub fn fold_segment_hash(parent: PathId, bytes: &[u8]) -> PathId {
    let mut h = parent.0;
    for &b in bytes {
        h = h.wrapping_mul(0x100000001b3);
        h ^= b as u64;
    }
    PathId(h)
}

/// Rolling hash generator for array indices.
#[inline(always)]
pub fn fold_index_hash(parent: PathId, index: usize) -> PathId {
    let mut h = parent.0;
    h = h.wrapping_mul(0x100000001b3);
    h ^= index as u64;
    PathId(h)
}
