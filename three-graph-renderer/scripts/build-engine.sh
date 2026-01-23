#!/bin/bash
set -e

# Define paths
ENGINE_DIR="../engine"
OUTPUT_DIR="./public/wasm"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Building Math Engine to WASM..."

# Run Emscripten
emcc \
  "$ENGINE_DIR/binding.cpp" \
  "$ENGINE_DIR/parser.cpp" \
  "$ENGINE_DIR/sampler.cpp" \
  "$ENGINE_DIR/analyzer.cpp" \
  -I "$ENGINE_DIR" \
  -I "$ENGINE_DIR/lib" \
  -O3 \
  -flto \
  --bind \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createMathModule' \
  -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s SINGLE_FILE=1 \
  -s ENVIRONMENT=web,worker \
  -s NO_FILESYSTEM=1 \
  -s ASSERTIONS=0 \
  -s DISABLE_EXCEPTION_CATCHING=1 \
  -s MALLOC=emmalloc \
  -s ALLOW_TABLE_GROWTH=1 \
  -s STACK_SIZE=5MB \
  -o "$OUTPUT_DIR/math_engine.js"

echo "Build complete! Artifacts in $OUTPUT_DIR"
