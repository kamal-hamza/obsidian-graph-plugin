#!/bin/bash
set -e

# Define paths
ENGINE_DIR="./engine"
OUTPUT_DIR_PUBLIC="./public/wasm"
OUTPUT_DIR_SRC="./src/wasm"

# Create output directories if they don't exist
mkdir -p "$OUTPUT_DIR_PUBLIC"
mkdir -p "$OUTPUT_DIR_SRC"

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
  -o "$OUTPUT_DIR_PUBLIC/math_engine.js"

echo "Copying to src directory for dev environment..."
cp "$OUTPUT_DIR_PUBLIC/math_engine.js" "$OUTPUT_DIR_SRC/math_engine.js"

echo "Build complete! Artifacts in:"
echo "  - $OUTPUT_DIR_PUBLIC (for production plugin)"
echo "  - $OUTPUT_DIR_SRC (for dev environment)"
