#include "parser.h"
#include "path.h"

#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#endif

namespace diffcore {

CompactParser::CompactParser(uint32_t max_keys)
    : max_object_keys_(max_keys) {
    tokens_.reserve(524288);
    value_index_.resize(262144, 0);
    path_stack_.reserve(64);
    array_indices_.reserve(64);
}

void CompactParser::clear() {
    tokens_.clear();
    std::fill(value_index_.begin(), value_index_.end(), 0);
    path_stack_.clear();
    array_indices_.clear();
    current_path_id_ = ROOT_PATH_ID;
    expecting_key_ = false;
    key_count_ = 0;
    chunk_base_offset_ = 0;
}

void CompactParser::push_token(PathId id, CompactEvent event, uint64_t hash, uint32_t offset, uint32_t len) {
    uint32_t tidx = static_cast<uint32_t>(tokens_.size());
    if (event == CompactEvent::Value && id < value_index_.size()) {
        value_index_[id] = tidx + 1; // +1 so 0 means "not found"
    }
    tokens_.push_back({id, event, hash, offset, len});
}

bool CompactParser::parse(const uint8_t* json, size_t len, PathArena& arena) {
    if (len == 0) return true;
    
    const uint8_t* ptr = json;
    const uint8_t* end = json + len;
    const uint8_t* start = json;

    while (ptr < end) {
        uint8_t b = *ptr;

        // SIMD Whitespace Skip
        if (b <= 0x20) {
#ifdef __wasm_simd128__
            if (ptr + 16 <= end) {
                v128_t chunk = wasm_v128_load(ptr);
                v128_t ws_max = wasm_i8x16_splat(0x20);
                v128_t cmp = wasm_u8x16_le(chunk, ws_max);
                int mask = wasm_i8x16_bitmask(cmp);
                if (mask == 0xFFFF) {
                    ptr += 16;
                    continue;
                }
            }
#endif
            if (b == ' ' || b == '\n' || b == '\r' || b == '\t') {
                ++ptr;
                continue;
            }
        }

        switch (b) {
            case '{':
                path_stack_.push_back(current_path_id_);
                push_token(current_path_id_, CompactEvent::StartObject, 0, 0, 0);
                expecting_key_ = true;
                key_count_ = 0;
                ++ptr;
                break;

            case '}':
                expecting_key_ = false;
                current_path_id_ = path_stack_.empty() ? ROOT_PATH_ID : path_stack_.back();
                if (!path_stack_.empty()) path_stack_.pop_back();
                push_token(current_path_id_, CompactEvent::EndObject, 0, 0, 0);
                ++ptr;
                break;

            case '[': {
                path_stack_.push_back(current_path_id_);
                push_token(current_path_id_, CompactEvent::StartArray, 0, 0, 0);
                array_indices_.push_back(0);
                SegmentId seg = arena.interner().intern_index(0);
                current_path_id_ = arena.get_child_path(current_path_id_, seg);
                ++ptr;
                break;
            }

            case ']':
                if (!array_indices_.empty()) array_indices_.pop_back();
                current_path_id_ = path_stack_.empty() ? ROOT_PATH_ID : path_stack_.back();
                if (!path_stack_.empty()) path_stack_.pop_back();
                push_token(current_path_id_, CompactEvent::EndArray, 0, 0, 0);
                ++ptr;
                break;

            case '"': {
                ++ptr; // skip "
                const uint8_t* str_start = ptr;
                
                // SIMD String Scan
                while (ptr < end) {
#ifdef __wasm_simd128__
                    if (ptr + 16 <= end) {
                        v128_t chunk = wasm_v128_load(ptr);
                        v128_t quote = wasm_i8x16_splat('"');
                        v128_t escape = wasm_i8x16_splat('\\');
                        v128_t hit = wasm_v128_or(
                            wasm_i8x16_eq(chunk, quote),
                            wasm_i8x16_eq(chunk, escape)
                        );
                        int mask = wasm_i8x16_bitmask(hit);
                        if (mask == 0) {
                            ptr += 16;
                            continue;
                        }
                    }
#endif
                    uint8_t c = *ptr;
                    if (c == '"') break;
                    if (c == '\\') ++ptr;
                    ++ptr;
                }
                
                if (ptr >= end) return false;
                size_t str_len = ptr - str_start;
                ++ptr; // skip closing "

                if (expecting_key_) {
                    ++key_count_;
                    if (key_count_ > max_object_keys_) return false;
                    SegmentId seg = arena.interner().intern_key(str_start, str_len);
                    PathId parent = path_stack_.empty() ? ROOT_PATH_ID : path_stack_.back();
                    current_path_id_ = arena.get_child_path(parent, seg);
                } else {
                    uint32_t offset = chunk_base_offset_ + static_cast<uint32_t>(str_start - start);
                    push_token(current_path_id_, CompactEvent::Value, 
                              fnv1a_hash(str_start, str_len), offset, static_cast<uint32_t>(str_len));
                }
                break;
            }

            case ':':
                expecting_key_ = false;
                ++ptr;
                break;

            case ',':
                if (!array_indices_.empty()) {
                    ++array_indices_.back();
                    PathId parent = path_stack_.empty() ? ROOT_PATH_ID : path_stack_.back();
                    SegmentId seg = arena.interner().intern_index(array_indices_.back());
                    current_path_id_ = arena.get_child_path(parent, seg);
                } else {
                    expecting_key_ = true;
                }
                ++ptr;
                break;

            default:
                if ((b >= '0' && b <= '9') || b == '-' || b == 't' || b == 'f' || b == 'n') {
                    const uint8_t* prim_start = ptr;
                    while (ptr < end) {
                        uint8_t c = *ptr;
                        if (c == ',' || c == '}' || c == ']' || c <= 0x20) break;
                        ++ptr;
                    }
                    size_t prim_len = ptr - prim_start;
                    uint32_t offset = chunk_base_offset_ + static_cast<uint32_t>(prim_start - start);
                    push_token(current_path_id_, CompactEvent::Value,
                              fnv1a_hash(prim_start, prim_len), offset, static_cast<uint32_t>(prim_len));
                    
                    if (array_indices_.empty() && !path_stack_.empty()) {
                        current_path_id_ = path_stack_.back();
                    }
                } else {
                    ++ptr;
                }
                break;
        }
    }
    
    return true;
}

} // namespace diffcore
