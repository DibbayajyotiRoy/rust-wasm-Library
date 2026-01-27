#pragma once
#include "common.h"
#include <vector>
#include <unordered_map>
#include <string>

namespace diffcore {

class PathInterner {
public:
    SegmentId intern_key(const uint8_t* key, size_t len);
    SegmentId intern_index(size_t index);
    
    const std::string& get_segment_string(SegmentId id) const {
        static std::string empty;
        if (id < strings_.size()) return strings_[id];
        return empty;
    }
    
    void clear() { 
        key_map_.clear(); 
        index_map_.clear(); 
        strings_.clear(); 
        strings_.push_back(""); // Reserve 0 for root
    }

private:
    std::unordered_map<uint64_t, SegmentId> key_map_;
    std::unordered_map<size_t, SegmentId> index_map_;
    std::vector<std::string> strings_;
};

class PathArena {
public:
    PathArena();
    
    PathId get_child_path(PathId parent, SegmentId segment);
    std::string path_to_string(PathId id) const;
    
    PathInterner& interner() { return interner_; }
    
    void clear();

private:
    std::unordered_map<uint64_t, PathId> trie_;
    std::vector<std::pair<PathId, SegmentId>> reverse_;
    PathInterner interner_;
    
    // L1 Cache
    PathId l1_parent_ = 0xFFFFFFFF;
    SegmentId l1_seg_ = 0xFFFFFFFF;
    PathId l1_id_ = ROOT_PATH_ID;
};

} // namespace diffcore
