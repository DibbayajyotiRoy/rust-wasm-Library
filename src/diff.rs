use crate::parser::{CompactParser, CompactEvent};
use crate::path::PathId;
use rustc_hash::FxHashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum DiffOp {
    Added = 0,
    Removed = 1,
    Modified = 2,
}

pub struct DiffEntry {
    pub op: DiffOp,
    pub path_id: PathId,
    pub left_val: Option<(u32, u32)>,
    pub right_val: Option<(u32, u32)>,
}

/// Silicon Path Diff Engine: Optimized for 64-bit sparse path IDs.
pub fn compute_compact_diff_v2(
    left: &CompactParser,
    right: &CompactParser,
) -> Vec<DiffEntry> {
    let mut diffs = Vec::with_capacity(128);
    
    // Create an O(1) lookup map for the Left parser's path hashes.
    // In Silicon Path, we move the hash map cost to the diff phase
    // where we only handle Value tokens, not every byte of structural noise.
    let mut left_map = FxHashMap::with_capacity_and_hasher(
        left.tokens().len() / 2, 
        Default::default()
    );

    for (idx, lt) in left.tokens().iter().enumerate() {
        if lt.event == CompactEvent::Value {
            left_map.insert(lt.path_id, idx);
        }
    }

    // Modified & Added Detection
    for rt in right.tokens() {
        if rt.event != CompactEvent::Value { continue; }
        
        match left_map.get(&rt.path_id) {
            Some(&lt_idx) => {
                let lt = &left.tokens()[lt_idx];
                if lt.value_hash != rt.value_hash {
                    diffs.push(DiffEntry {
                        op: DiffOp::Modified,
                        path_id: rt.path_id,
                        left_val: Some((lt.raw_offset, lt.raw_len)),
                        right_val: Some((rt.raw_offset, rt.raw_len)),
                    });
                }
            }
            None => {
                diffs.push(DiffEntry {
                    op: DiffOp::Added,
                    path_id: rt.path_id,
                    left_val: None,
                    right_val: Some((rt.raw_offset, rt.raw_len)),
                });
            }
        }
    }

    // Removed Detection
    // For extreme performance, we build a Right map only if strictly necessary,
    // but a symmetric check is safer for v1.
    let mut right_map = FxHashMap::with_capacity_and_hasher(
        right.tokens().len() / 2, 
        Default::default()
    );
    for rt in right.tokens() {
        if rt.event == CompactEvent::Value {
            right_map.insert(rt.path_id, ());
        }
    }

    for lt in left.tokens() {
        if lt.event != CompactEvent::Value { continue; }
        if !right_map.contains_key(&lt.path_id) {
            diffs.push(DiffEntry {
                op: DiffOp::Removed,
                path_id: lt.path_id,
                left_val: Some((lt.raw_offset, lt.raw_len)),
                right_val: None,
            });
        }
    }

    diffs
}
