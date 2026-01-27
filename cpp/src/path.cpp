#include "path.h"
#include <sstream>

namespace diffcore {

SegmentId PathInterner::intern_key(const uint8_t* key, size_t len) {
    uint64_t hash = fnv1a_hash(key, len);
    auto it = key_map_.find(hash);
    if (it != key_map_.end()) return it->second;
    
    SegmentId id = static_cast<SegmentId>(strings_.size());
    strings_.emplace_back(reinterpret_cast<const char*>(key), len);
    key_map_[hash] = id;
    return id;
}

SegmentId PathInterner::intern_index(size_t index) {
    auto it = index_map_.find(index);
    if (it != index_map_.end()) return it->second;
    
    SegmentId id = static_cast<SegmentId>(strings_.size());
    strings_.push_back("[" + std::to_string(index) + "]");
    index_map_[index] = id;
    return id;
}

PathArena::PathArena() {
    reverse_.reserve(262144);
    reverse_.push_back({ROOT_PATH_ID, 0}); // Root
    interner_.clear();
}

void PathArena::clear() {
    trie_.clear();
    reverse_.clear();
    reverse_.push_back({ROOT_PATH_ID, 0});
    interner_.clear();
    l1_parent_ = 0xFFFFFFFF;
    l1_seg_ = 0xFFFFFFFF;
}

PathId PathArena::get_child_path(PathId parent, SegmentId segment) {
    // L1 Cache hit
    if (parent == l1_parent_ && segment == l1_seg_) {
        return l1_id_;
    }
    
    uint64_t key = (static_cast<uint64_t>(parent) << 32) | segment;
    auto it = trie_.find(key);
    if (it != trie_.end()) {
        l1_parent_ = parent;
        l1_seg_ = segment;
        l1_id_ = it->second;
        return it->second;
    }
    
    PathId id = static_cast<PathId>(reverse_.size());
    trie_[key] = id;
    reverse_.push_back({parent, segment});
    
    l1_parent_ = parent;
    l1_seg_ = segment;
    l1_id_ = id;
    return id;
}

std::string PathArena::path_to_string(PathId id) const {
    if (id == ROOT_PATH_ID) return "$";
    
    std::vector<SegmentId> segments;
    PathId current = id;
    while (current != ROOT_PATH_ID && current < reverse_.size()) {
        segments.push_back(reverse_[current].second);
        current = reverse_[current].first;
    }
    
    std::ostringstream oss;
    oss << "$";
    for (auto it = segments.rbegin(); it != segments.rend(); ++it) {
        const std::string& seg = interner_.get_segment_string(*it);
        if (!seg.empty() && seg[0] == '[') {
            oss << seg;
        } else {
            oss << "." << seg;
        }
    }
    return oss.str();
}

} // namespace diffcore
