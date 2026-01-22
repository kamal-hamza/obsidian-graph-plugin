#!/bin/bash
# ==============================================================================
# Build Pipeline for Obsidian Graphing Plugin
# Compiles C++ to WASM and prepares it for the Obsidian plugin
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="${SCRIPT_DIR}/engine"
PLUGIN_DIR="${SCRIPT_DIR}/plugin"
PLUGIN_WASM_DIR="${PLUGIN_DIR}/src/wasm"
ENGINE_WASM_OUTPUT="${ENGINE_DIR}/wasm"

# Helper functions
print_header() {
    echo -e "${BLUE}===============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Show help
show_help() {
    echo "Usage: ./build-plugin.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  wasm            Build only WASM (C++ engine)"
    echo "  plugin          Build only plugin (TypeScript)"
    echo "  all             Build WASM and plugin (default)"
    echo "  dev             Build in development mode with watch"
    echo "  clean           Clean all build artifacts"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./build-plugin.sh           # Build everything"
    echo "  ./build-plugin.sh wasm      # Build only WASM"
    echo "  ./build-plugin.sh plugin    # Build only plugin"
    echo "  ./build-plugin.sh dev       # Development mode with watch"
}

# Check if Emscripten is available
check_emscripten() {
    if ! command -v emcc &> /dev/null; then
        print_error "Emscripten (emcc) not found!"
        print_info "Please install Emscripten or activate the emsdk environment:"
        print_info "  brew install emscripten"
        exit 1
    fi
    print_success "Emscripten found: $(which emcc)"
}

# Check if Node.js is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found!"
        print_info "Please install Node.js:"
        print_info "  brew install node"
        exit 1
    fi
    print_success "Node.js found: $(node --version)"
}

# Build WASM
build_wasm() {
    print_header "Building WebAssembly Module"
    
    check_emscripten
    
    cd "${ENGINE_DIR}"
    
    # Create build directory
    mkdir -p build-wasm
    
    print_info "Configuring CMake with Emscripten..."
    cd build-wasm
    emcmake cmake -DCMAKE_BUILD_TYPE=Release \
                  -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
                  .. > /dev/null 2>&1 || {
        print_error "CMake configuration failed"
        exit 1
    }
    
    print_info "Compiling C++ to WebAssembly..."
    make -j4 > /dev/null 2>&1 || {
        print_error "WASM compilation failed"
        exit 1
    }
    
    # Copy compile_commands.json for LSP
    mkdir -p ../build
    cp compile_commands.json ../build/
    
    cd "${SCRIPT_DIR}"
    
    print_success "WASM compilation complete!"
    
    # Copy WASM output to plugin directory
    print_info "Copying WASM module to plugin directory..."
    mkdir -p "${PLUGIN_WASM_DIR}"
    
    if [ -f "${ENGINE_WASM_OUTPUT}/math_engine.js" ]; then
        cp "${ENGINE_WASM_OUTPUT}/math_engine.js" "${PLUGIN_WASM_DIR}/"
        print_success "WASM module copied to: ${PLUGIN_WASM_DIR}/math_engine.js"
        
        # Show file size
        WASM_SIZE=$(du -h "${PLUGIN_WASM_DIR}/math_engine.js" | cut -f1)
        print_info "WASM bundle size: ${WASM_SIZE}"
    else
        print_error "WASM output file not found at ${ENGINE_WASM_OUTPUT}/math_engine.js"
        exit 1
    fi
}

# Build plugin
build_plugin() {
    print_header "Building Obsidian Plugin"
    
    check_nodejs
    
    cd "${PLUGIN_DIR}"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in plugin directory"
        print_info "Please create the plugin structure first"
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Build the plugin
    print_info "Building plugin with esbuild..."
    npm run build || {
        print_error "Plugin build failed"
        exit 1
    }
    
    cd "${SCRIPT_DIR}"
    
    print_success "Plugin build complete!"
    
    # Show output files
    if [ -f "${PLUGIN_DIR}/main.js" ]; then
        PLUGIN_SIZE=$(du -h "${PLUGIN_DIR}/main.js" | cut -f1)
        print_info "Plugin bundle size: ${PLUGIN_SIZE}"
    fi
}

# Development mode with watch
dev_mode() {
    print_header "Starting Development Mode"
    
    print_info "Building WASM first..."
    build_wasm
    
    print_info "Starting plugin development server..."
    cd "${PLUGIN_DIR}"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in plugin directory"
        print_info "Please create the plugin structure first"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    print_success "Starting watch mode..."
    print_info "Press Ctrl+C to stop"
    npm run dev
}

# Clean build artifacts
clean_all() {
    print_header "Cleaning Build Artifacts"
    
    print_info "Cleaning engine build..."
    rm -rf "${ENGINE_DIR}/build-wasm"
    rm -rf "${ENGINE_DIR}/wasm"
    rm -rf "${ENGINE_DIR}/bin"
    
    print_info "Cleaning plugin build..."
    rm -f "${PLUGIN_DIR}/main.js"
    rm -f "${PLUGIN_DIR}/main.js.map"
    rm -f "${PLUGIN_DIR}/styles.css"
    rm -rf "${PLUGIN_WASM_DIR}"
    
    print_success "All build artifacts cleaned"
}

# Main script logic
case "${1:-all}" in
    wasm)
        build_wasm
        ;;
    plugin)
        build_plugin
        ;;
    all)
        build_wasm
        echo ""
        build_plugin
        print_header "Build Complete!"
        print_success "WASM and Plugin built successfully"
        ;;
    dev)
        dev_mode
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

exit 0