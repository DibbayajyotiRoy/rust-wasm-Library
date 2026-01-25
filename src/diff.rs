//! Optimized diff using CompactToken.

use crate::parser::{CompactToken, CompactEvent, CompactParser};
use crate::path::{PathArena, PathId};
use rustc_hash::FxHashMap;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffOp { Added = 0, Removed = 1, Modified = 2 }

pub struct DiffEntry {
    pub op: DiffOp,
    pub path_id: PathId,
    pub left_val: (u32, u32), // offset, len
    pub right_val: (u32, u32),
}

pub fn compute_compact_diff(
    left: &CompactParser,
    right: &CompactParser,
) -> Vec<DiffEntry> {
    let mut left_map = FxHashMap::with_capacity_and_hasher(left.tokens().len(), Default::default());
    for t in left.tokens() {
        if t.event == CompactEvent::Value {
            left_map.insert(t.path_id, t);
        }
    }

    let mut right_map = FxHashMap::with_capacity_and_hasher(right.tokens().len(), Default::default());
    for t in right.tokens() {
        if t.event == CompactEvent::Value {
            right_map.insert(t.path_id, t);
        }
    }

    let mut diffs = Vec::new();

    // Modified & Removed
    for (&path_id, l_token) in &left_map {
        if let Some(r_token) = right_map.get(&path_id) {
            if l_token.value_hash != r_token.value_hash {
                diffs.push(DiffEntry {
                    op: DiffOp::Modified,
                    path_id,
                    left_val: (l_token.raw_offset, l_token.raw_len),
                    right_val: (r_token.raw_offset, r_token.raw_len),
                });
            }
        } else {
            diffs.push(DiffEntry {
                op: DiffOp::Removed,
                path_id,
                left_val: (l_token.raw_offset, l_token.raw_len),
                right_val: (0, 0),
            });
        }
    }

    // Added
    for (&path_id, r_token) in &right_map {
        if !left_map.contains_key(&path_id) {
            diffs.push(DiffEntry {
                op: DiffOp::Added,
                path_id,
                left_val: (0, 0),
                right_val: (r_token.raw_offset, r_token.raw_len),
            });
        }
    }

    diffs.sort_by_key(|d| d.path_id);
    diffs
}
