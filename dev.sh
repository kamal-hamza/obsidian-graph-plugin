#!/bin/bash
# ==============================================================================
# Development Helper Script
# Watches for changes and rebuilds the plugin automatically
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR}/plugin"

print_header() {
    echo -e "${BLUE}===============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_header "Math Graph Plugin - Development Mode"
echo ""
print_info "This will watch for changes and rebuild automatically"
print_info "Press Ctrl+C to stop"
echo ""
print_info "Plugin is symlinked to: /Users/hkamal/Obsidian/Testing Vault/.obsidian/plugins/math-graph-plugin"
print_info "After changes, reload Obsidian with Cmd/Ctrl + R"
echo ""

# Check if already symlinked
if [ -L "/Users/hkamal/Obsidian/Testing Vault/.obsidian/plugins/math-graph-plugin" ]; then
    print_success "Plugin symlink is active"
else
    print_info "Creating symlink to vault..."
    ln -sf "${PLUGIN_DIR}" "/Users/hkamal/Obsidian/Testing Vault/.obsidian/plugins/math-graph-plugin"
    print_success "Symlink created"
fi

echo ""
print_header "Starting Watch Mode"

cd "${PLUGIN_DIR}"
npm run dev