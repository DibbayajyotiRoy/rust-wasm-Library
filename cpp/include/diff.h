#pragma once
#include "common.h"
#include "parser.h"
#include <vector>

namespace diffcore {

enum class DiffOp : uint8_t {
    Added = 0,
    Removed = 1,
    Modified = 2
};

struct DiffEntry {
    DiffOp op;
    PathId path_id;
    uint32_t left_offset;
    uint32_t left_len;
    uint32_t right_offset;
    uint32_t right_len;
};

std::vector<DiffEntry> compute_diff(
    const CompactParser& left,
    const CompactParser& right
);

} // namespace diffcore
