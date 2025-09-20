#!/bin/bash
# ================================
# Build Script for Order Matching Engine
# ================================

set -e  # Exit immediately if a command fails

# 1. Set project root (assumes this script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# 2. Create build directory if it doesn't exist
BUILD_DIR="$PROJECT_ROOT/build"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# 3. Run CMake to configure project
echo "Running CMake..."
cmake .. -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++

# 4. Build the project
echo "Building project..."
make -j$(nproc)


echo "Build completed successfully!"
