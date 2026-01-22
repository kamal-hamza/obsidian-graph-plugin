# ==============================================================================
# Emscripten Toolchain File for CMake
# ==============================================================================
# This file configures CMake to use Emscripten for WebAssembly compilation
# Usage: cmake -B build -DCMAKE_TOOLCHAIN_FILE=toolchain.cmake

set(CMAKE_SYSTEM_NAME Emscripten)
set(CMAKE_SYSTEM_PROCESSOR x86)

# Find emcc and em++ in PATH
find_program(EMCC_EXECUTABLE emcc REQUIRED)
find_program(EMXX_EXECUTABLE em++ REQUIRED)

if(NOT EMCC_EXECUTABLE OR NOT EMXX_EXECUTABLE)
    message(FATAL_ERROR "Could not find Emscripten (emcc/em++). Please install it via Homebrew or activate emsdk.")
endif()

# Set compilers
set(CMAKE_C_COMPILER "${EMCC_EXECUTABLE}")
set(CMAKE_CXX_COMPILER "${EMXX_EXECUTABLE}")

# Set the executable suffix
set(CMAKE_EXECUTABLE_SUFFIX ".js")

# Configure CMake to use Emscripten
set(CMAKE_CROSSCOMPILING TRUE)
set(CMAKE_CROSSCOMPILING_EMULATOR "node")

# Set Emscripten-specific variables
set(EMSCRIPTEN TRUE)

# Configure find_* commands to not look in host paths
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

message(STATUS "Using Emscripten toolchain")
message(STATUS "  C Compiler: ${CMAKE_C_COMPILER}")
message(STATUS "  C++ Compiler: ${CMAKE_CXX_COMPILER}")