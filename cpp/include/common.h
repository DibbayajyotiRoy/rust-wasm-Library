#pragma once
#include <cstdint>
#include <vector>

namespace diffcore {

using PathId = uint32_t;
using SegmentId = uint32_t;
constexpr PathId ROOT_PATH_ID = 0;

// FNV-1a hash (extremely fast)
inline uint64_t fnv1a_hash(const uint8_t* data, size_t len) {
    uint64_t hash = 0xcbf29ce484222325ULL;
    for (size_t i = 0; i < len; ++i) {
        hash ^= data[i];
        hash *= 0x100000001b3ULL;
    }
    return hash;
}

} // namespace diffcore
