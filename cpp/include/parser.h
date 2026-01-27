#pragma once
#include "common.h"
#include <vector>
#include <cstring>

#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#endif

namespace diffcore {

enum class CompactEvent : uint8_t {
    StartObject = 0,
    EndObject = 1,
    StartArray = 2,
    EndArray = 3,
    Value = 4
};

struct CompactToken {
    PathId path_id;
    CompactEvent event;
    uint64_t value_hash;
    uint32_t raw_offset;
    uint32_t raw_len;
};

class PathArena;

class CompactParser {
public:
    explicit CompactParser(uint32_t max_keys = 100000);
    
    bool parse(const uint8_t* json, size_t len, PathArena& arena);
    void clear();
    
    const std::vector<CompactToken>& tokens() const { return tokens_; }
    
    // O(1) lookup: PathId -> token index (0 = not found)
    uint32_t value_index_get(PathId id) const {
        if (id < value_index_.size()) return value_index_[id];
        return 0;
    }

private:
    std::vector<CompactToken> tokens_;
    std::vector<uint32_t> value_index_;
    std::vector<PathId> path_stack_;
    std::vector<size_t> array_indices_;
    
    PathId current_path_id_ = ROOT_PATH_ID;
    bool expecting_key_ = false;
    uint32_t key_count_ = 0;
    uint32_t max_object_keys_;
    uint32_t chunk_base_offset_ = 0;
    
    void push_token(PathId id, CompactEvent event, uint64_t hash, uint32_t offset, uint32_t len);
};

} // namespace diffcore
