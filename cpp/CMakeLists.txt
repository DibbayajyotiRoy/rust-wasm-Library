cmake_minimum_required(VERSION 3.16)
project(diffcore_cpp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten-specific settings
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
    
    # Maximum optimization with SIMD and bulk-memory
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -flto -ffast-math -fno-math-errno")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -mbulk-memory -mmutable-globals")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions -fno-rtti")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fomit-frame-pointer -fmerge-all-constants -fno-stack-protector")
    
    # Emscripten linker flags - Standalone WASM
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s WASM=1")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s STANDALONE_WASM=1")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s ALLOW_MEMORY_GROWTH=1")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s INITIAL_MEMORY=67108864")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s MAXIMUM_MEMORY=268435456")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s STACK_SIZE=1048576")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s EXPORTED_FUNCTIONS=['_create_engine','_destroy_engine','_clear_engine','_get_left_input_ptr','_get_right_input_ptr','_commit_left','_commit_right','_finalize','_get_result_len','_batch_resolve_symbols','__internal_alloc','__internal_dealloc','_malloc','_free']")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} --no-entry --lto-O3")
endif()

# Source files
set(SOURCES
    src/main.cpp
    src/parser.cpp
    src/path.cpp
    src/diff.cpp
    src/engine.cpp
)

# Header files
set(HEADERS
    include/diffcore.h
    include/parser.h
    include/path.h
    include/diff.h
)

# Create library
add_executable(diffcore ${SOURCES} ${HEADERS})

target_include_directories(diffcore PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)

# Post-build: Copy to pkg
if(EMSCRIPTEN)
    add_custom_command(TARGET diffcore POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:diffcore> ${CMAKE_CURRENT_SOURCE_DIR}/../pkg/diffcore_cpp.js
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/diffcore.wasm ${CMAKE_CURRENT_SOURCE_DIR}/../pkg/diffcore_cpp.wasm
    )
endif()
