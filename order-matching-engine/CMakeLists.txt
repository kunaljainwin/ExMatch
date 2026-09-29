cmake_minimum_required(VERSION 3.16)
project(order_matching_engine)

# Use C++17 standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_definitions(-DPROJECT_ROOT="${CMAKE_SOURCE_DIR}/")

# Include directories
include_directories(
    ${PROJECT_SOURCE_DIR}/inc
)

file(GLOB_RECURSE SOURCES
    ${PROJECT_SOURCE_DIR}/src/*.cpp
)
list(FILTER SOURCES EXCLUDE REGEX ".*_test.cpp$")

# Executable
add_executable(${PROJECT_NAME} ${SOURCES})


# Optional: Enable warnings
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /permissive-)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -pedantic)
endif()

# Unit Tests
enable_testing()
add_executable(order_book_test
    ${PROJECT_SOURCE_DIR}/tests/order_book_test.cpp
    ${PROJECT_SOURCE_DIR}/src/core/order_book.cpp
)
target_include_directories(order_book_test PRIVATE ${PROJECT_SOURCE_DIR}/inc)
if(MSVC)
    target_compile_options(order_book_test PRIVATE /W4 /permissive-)
else()
    target_compile_options(order_book_test PRIVATE -Wall -Wextra -pedantic)
endif()

add_test(NAME OrderBookTests COMMAND order_book_test)
