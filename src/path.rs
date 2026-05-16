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
///
/// The index is run through the 64-bit golden-ratio constant before being
/// folded in. Without this, `fold_index_hash(p, 48)` equalled
/// `fold_segment_hash(p, "0")` (both `p*PRIME ^ 0x30`) — so array element
/// `[48]` and object key `"0"` under a shared parent produced the same
/// `PathId` and the diff conflated them. The mix moves array indices into a
/// disjoint sub-space from object keys.
///
/// NOTE: mirrored byte-for-byte by `foldIndex` in `js/src/path-index.ts`.
/// The two implementations MUST stay in lockstep.
#[inline(always)]
pub fn fold_index_hash(parent: PathId, index: usize) -> PathId {
    let mut h = parent.0.wrapping_mul(0x100000001b3);
    h ^= (index as u64)
        .wrapping_add(1)
        .wrapping_mul(0x9E37_79B9_7F4A_7C15);
    PathId(h)
}
