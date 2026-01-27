#pragma once
#include <cstdint>
#include <cstddef>

// Forward declarations
struct DiffEngine;

extern "C" {

// Engine lifecycle
DiffEngine* create_engine(uint32_t max_memory, uint32_t max_input);
void destroy_engine(DiffEngine* engine);
void clear_engine(DiffEngine* engine);

// DMA Input Pointers
uint8_t* get_left_input_ptr(DiffEngine* engine);
uint8_t* get_right_input_ptr(DiffEngine* engine);

// Ingestion
int32_t commit_left(DiffEngine* engine, uint32_t len);
int32_t commit_right(DiffEngine* engine, uint32_t len);

// Finalize and get result
const uint8_t* finalize(DiffEngine* engine);
uint32_t get_result_len(DiffEngine* engine);

// Symbol resolution
const uint8_t* batch_resolve_symbols(DiffEngine* engine, uint32_t* out_len);

// Memory allocation helpers (for JS interop)
void* _internal_alloc(size_t size);
void _internal_dealloc(void* ptr, size_t size);

}
