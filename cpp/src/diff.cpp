#include "diff.h"

namespace diffcore {

std::vector<DiffEntry> compute_diff(
    const CompactParser& left,
    const CompactParser& right
) {
    std::vector<DiffEntry> diffs;
    diffs.reserve(64);
    
    const auto& right_tokens = right.tokens();
    const auto& left_tokens = left.tokens();

    // Modified & Added
    for (const auto& rt : right_tokens) {
        if (rt.event != CompactEvent::Value) continue;
        
        uint32_t lt_idx = left.value_index_get(rt.path_id);
        if (lt_idx > 0) {
            const auto& lt = left_tokens[lt_idx - 1];
            if (lt.value_hash != rt.value_hash) {
                diffs.push_back({
                    DiffOp::Modified,
                    rt.path_id,
                    lt.raw_offset, lt.raw_len,
                    rt.raw_offset, rt.raw_len
                });
            }
        } else {
            diffs.push_back({
                DiffOp::Added,
                rt.path_id,
                0, 0,
                rt.raw_offset, rt.raw_len
            });
        }
    }

    // Removed
    for (const auto& lt : left_tokens) {
        if (lt.event != CompactEvent::Value) continue;
        
        if (right.value_index_get(lt.path_id) == 0) {
            diffs.push_back({
                DiffOp::Removed,
                lt.path_id,
                lt.raw_offset, lt.raw_len,
                0, 0
            });
        }
    }

    return diffs;
}

} // namespace diffcore
