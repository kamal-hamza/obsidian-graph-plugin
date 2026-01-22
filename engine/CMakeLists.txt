# ==============================================================================
# CMakeLists.txt for Math Engine
# Supports both Native C++ and WebAssembly (Emscripten) builds
# ==============================================================================

cmake_minimum_required(VERSION 3.15)
project(MathEngine VERSION 1.0.0 LANGUAGES CXX)

# C++ Standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Export compile commands for clangd/LSP support
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ==============================================================================
# Compiler Flags
# ==============================================================================

# Native build flags
if(NOT EMSCRIPTEN)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
    set(CMAKE_CXX_FLAGS_RELEASE "-O2")
    set(CMAKE_CXX_FLAGS_DEBUG "-g -O0")
endif()

# ==============================================================================
# Source Files
# ==============================================================================

set(ENGINE_SOURCES
    parser.cpp
    sampler.cpp
    analyzer.cpp
)

set(ENGINE_HEADERS
    engine.hpp
    parser.h
    sampler.h
    analyzer.h
    lib/exprtk.hpp
)

# ==============================================================================
# Include Directories
# ==============================================================================

include_directories(${CMAKE_CURRENT_SOURCE_DIR})
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/lib)

# ==============================================================================
# WebAssembly Build (Emscripten)
# ==============================================================================

if(EMSCRIPTEN)
    message(STATUS "Configuring for WebAssembly (Emscripten) build")
    
    # WASM output
    add_executable(math_engine
        binding.cpp
        ${ENGINE_SOURCES}
    )
    
    # Emscripten-specific flags for maximum performance
    target_compile_options(math_engine PRIVATE
        -O3
        -flto
    )
    
    target_link_options(math_engine PRIVATE
        -O3
        --bind
        -flto
        "SHELL:-s WASM=1"
        "SHELL:-s MODULARIZE=1"
        "SHELL:-s EXPORT_NAME='createMathModule'"
        "SHELL:-s EXPORT_ES6=1"
        "SHELL:-s ALLOW_MEMORY_GROWTH=1"
        "SHELL:-s SINGLE_FILE=1"
        "SHELL:-s ENVIRONMENT=web,worker"
        "SHELL:-s FILESYSTEM=0"
        "SHELL:-s ASSERTIONS=0"
        "SHELL:-s DISABLE_EXCEPTION_CATCHING=1"
        "SHELL:-s MALLOC=emmalloc"
        "SHELL:-s ALLOW_TABLE_GROWTH=1"
        "SHELL:-s STACK_SIZE=5MB"
    )
    
    # Set output directory and name
    set_target_properties(math_engine PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/wasm"
        OUTPUT_NAME "math_engine"
        SUFFIX ".js"
    )
    
    message(STATUS "WASM output will be generated in: ${CMAKE_SOURCE_DIR}/wasm/")
    
else()
    # ==============================================================================
    # Native C++ Build
    # ==============================================================================
    
    message(STATUS "Configuring for Native C++ build")
    
    # Create a library from the engine sources
    add_library(math_engine_lib STATIC
        ${ENGINE_SOURCES}
    )
    
    target_include_directories(math_engine_lib PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/lib
    )
    
    # Optional: Create a test executable if test.cpp exists
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/test.cpp")
        add_executable(test_engine test.cpp)
        target_link_libraries(test_engine PRIVATE math_engine_lib)
        
        set_target_properties(test_engine PROPERTIES
            RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/bin"
        )
        
        message(STATUS "Test executable will be built")
    endif()
    
    # Optional: Create main executable if main.cpp exists
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/main.cpp")
        add_executable(main_engine main.cpp)
        target_link_libraries(main_engine PRIVATE math_engine_lib)
        
        set_target_properties(main_engine PROPERTIES
            RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/bin"
        )
        
        message(STATUS "Main executable will be built")
    endif()
    
endif()

# ==============================================================================
# Installation (Optional)
# ==============================================================================

if(EMSCRIPTEN)
    install(FILES
        "${CMAKE_SOURCE_DIR}/wasm/math_engine.js"
        "${CMAKE_SOURCE_DIR}/wasm/math_engine.wasm"
        DESTINATION wasm
    )
else()
    install(TARGETS math_engine_lib
        ARCHIVE DESTINATION lib
        LIBRARY DESTINATION lib
    )
    
    install(FILES ${ENGINE_HEADERS}
        DESTINATION include/math_engine
    )
endif()

# ==============================================================================
# Print Configuration Summary
# ==============================================================================

message(STATUS "==============================================================================")
message(STATUS "Configuration Summary:")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Compiler: ${CMAKE_CXX_COMPILER}")
if(EMSCRIPTEN)
    message(STATUS "  Target: WebAssembly (Emscripten)")
    message(STATUS "  Output: ${CMAKE_SOURCE_DIR}/wasm/math_engine.js")
else()
    message(STATUS "  Target: Native C++")
    message(STATUS "  Output: ${CMAKE_SOURCE_DIR}/bin/")
endif()
message(STATUS "  Export Compile Commands: ${CMAKE_EXPORT_COMPILE_COMMANDS}")
message(STATUS "==============================================================================")