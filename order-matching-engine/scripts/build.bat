@echo off
REM ================================
REM Build Script for Order Matching Engine
REM ================================

REM 1. Set project root (assumes scripts/ is inside project root)
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
cd /d "%PROJECT_ROOT%"

REM 2. Create build directory if it doesn't exist
if not exist build (
    mkdir build
)

cd build

REM 3. Run CMake to configure project
cmake .. -G "MinGW Makefiles" -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++

REM 4. Build the project
mingw32-make


REM 5. Finished
echo.
echo Build completed!
pause
