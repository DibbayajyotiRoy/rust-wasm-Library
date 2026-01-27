#include "diffcore.h"
#include "parser.h"
#include "path.h"
#include "diff.h"
#include <cstdlib>
#include <vector>
#include <cstring>

using namespace diffcore;

// Forward declare the engine class
class DiffEngineImpl {
public:
    DiffEngineImpl(uint32_t max_memory, uint32_t max_input)
        : max_input_(max_input) {
        left_input_.resize(max_input / 2);
        right_input_.resize(max_input / 2);
        result_buffer_.reserve(16384);
    }
    
    uint8_t* left_input_ptr() { return left_input_.data(); }
    uint8_t* right_input_ptr() { return right_input_.data(); }
    
    int32_t commit_left(uint32_t len) {
        if (len > left_input_.size()) return -1;
        return left_parser_.parse(left_input_.data(), len, path_arena_) ? 0 : -1;
    }
    
    int32_t commit_right(uint32_t len) {
        if (len > right_input_.size()) return -1;
        return right_parser_.parse(right_input_.data(), len, path_arena_) ? 0 : -1;
    }
    
    const uint8_t* finalize() {
        diffs_ = compute_diff(left_parser_, right_parser_);
        
        result_buffer_.clear();
        
        uint16_t major = 2, minor = 1;
        result_buffer_.insert(result_buffer_.end(), reinterpret_cast<uint8_t*>(&major), 
                             reinterpret_cast<uint8_t*>(&major) + 2);
        result_buffer_.insert(result_buffer_.end(), reinterpret_cast<uint8_t*>(&minor), 
                             reinterpret_cast<uint8_t*>(&minor) + 2);
        uint32_t count = static_cast<uint32_t>(diffs_.size());
        result_buffer_.insert(result_buffer_.end(), reinterpret_cast<uint8_t*>(&count), 
                             reinterpret_cast<uint8_t*>(&count) + 4);
        uint64_t placeholder = 0;
        result_buffer_.insert(result_buffer_.end(), reinterpret_cast<uint8_t*>(&placeholder), 
                             reinterpret_cast<uint8_t*>(&placeholder) + 8);
        
        for (const auto& d : diffs_) {
            result_buffer_.push_back(static_cast<uint8_t>(d.op));
            result_buffer_.insert(result_buffer_.end(), reinterpret_cast<const uint8_t*>(&d.path_id),
                                 reinterpret_cast<const uint8_t*>(&d.path_id) + 4);
            result_buffer_.insert(result_buffer_.end(), reinterpret_cast<const uint8_t*>(&d.left_offset),
                                 reinterpret_cast<const uint8_t*>(&d.left_offset) + 4);
            result_buffer_.insert(result_buffer_.end(), reinterpret_cast<const uint8_t*>(&d.left_len),
                                 reinterpret_cast<const uint8_t*>(&d.left_len) + 4);
            result_buffer_.insert(result_buffer_.end(), reinterpret_cast<const uint8_t*>(&d.right_offset),
                                 reinterpret_cast<const uint8_t*>(&d.right_offset) + 4);
            result_buffer_.insert(result_buffer_.end(), reinterpret_cast<const uint8_t*>(&d.right_len),
                                 reinterpret_cast<const uint8_t*>(&d.right_len) + 4);
            result_buffer_.push_back(0);
            result_buffer_.push_back(0);
            result_buffer_.push_back(0);
        }
        
        uint64_t total_len = result_buffer_.size();
        std::memcpy(result_buffer_.data() + 8, &total_len, 8);
        
        return result_buffer_.data();
    }
    
    uint32_t result_len() const { return static_cast<uint32_t>(result_buffer_.size()); }
    
    const uint8_t* batch_resolve_symbols(uint32_t* out_len) {
        symbol_buffer_.clear();
        uint32_t count = static_cast<uint32_t>(diffs_.size());
        symbol_buffer_.insert(symbol_buffer_.end(), reinterpret_cast<uint8_t*>(&count),
                             reinterpret_cast<uint8_t*>(&count) + 4);
        
        for (const auto& d : diffs_) {
            std::string path = path_arena_.path_to_string(d.path_id);
            uint32_t len = static_cast<uint32_t>(path.size());
            symbol_buffer_.insert(symbol_buffer_.end(), reinterpret_cast<uint8_t*>(&len),
                                 reinterpret_cast<uint8_t*>(&len) + 4);
            symbol_buffer_.insert(symbol_buffer_.end(), path.begin(), path.end());
        }
        
        *out_len = static_cast<uint32_t>(symbol_buffer_.size());
        return symbol_buffer_.data();
    }
    
    void clear() {
        left_parser_.clear();
        right_parser_.clear();
        path_arena_.clear();
        diffs_.clear();
        result_buffer_.clear();
        symbol_buffer_.clear();
    }

private:
    CompactParser left_parser_;
    CompactParser right_parser_;
    PathArena path_arena_;
    std::vector<DiffEntry> diffs_;
    std::vector<uint8_t> left_input_;
    std::vector<uint8_t> right_input_;
    std::vector<uint8_t> result_buffer_;
    std::vector<uint8_t> symbol_buffer_;
    uint32_t max_input_;
};

// C FFI Exports
extern "C" {

DiffEngine* create_engine(uint32_t max_memory, uint32_t max_input) {
    return reinterpret_cast<DiffEngine*>(new DiffEngineImpl(max_memory, max_input));
}

void destroy_engine(DiffEngine* engine) {
    delete reinterpret_cast<DiffEngineImpl*>(engine);
}

void clear_engine(DiffEngine* engine) {
    reinterpret_cast<DiffEngineImpl*>(engine)->clear();
}

uint8_t* get_left_input_ptr(DiffEngine* engine) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->left_input_ptr();
}

uint8_t* get_right_input_ptr(DiffEngine* engine) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->right_input_ptr();
}

int32_t commit_left(DiffEngine* engine, uint32_t len) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->commit_left(len);
}

int32_t commit_right(DiffEngine* engine, uint32_t len) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->commit_right(len);
}

const uint8_t* finalize(DiffEngine* engine) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->finalize();
}

uint32_t get_result_len(DiffEngine* engine) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->result_len();
}

const uint8_t* batch_resolve_symbols(DiffEngine* engine, uint32_t* out_len) {
    return reinterpret_cast<DiffEngineImpl*>(engine)->batch_resolve_symbols(out_len);
}

void* _internal_alloc(size_t size) {
    return std::malloc(size);
}

void _internal_dealloc(void* ptr, size_t) {
    std::free(ptr);
}

}
