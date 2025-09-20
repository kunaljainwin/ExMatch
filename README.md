# "Trading Suite" overview

trading-suite/                  # Root repository
├── README.md                   # Main overview of the suite
├── CMakeLists.txt              # Optional, can be root CMake for all projects
├── order-matching-engine/      # Your current project
│   ├── CMakeLists.txt
│   ├── include/
│   ├── src/
│   └── tests/
├── market-data-engine/         # Future submodule/project
├── risk-management/            # Another potential project
└── third_party/                # Shared libraries for all projects


order-matching-engine/
├── CMakeLists.txt
├── cmake/                   # Extra cmake modules (if needed)
├── build/                   # Out-of-source builds (ignored in git)
├── docs/                    # Documentation
├── include/                 # Public headers
│   └── engine/
│       ├── Order.hpp
│       ├── Trade.hpp
│       ├── OrderBook.hpp
│       ├── MatchingEngine.hpp
│       └── Utils.hpp
├── src/                     # Source files
│   ├── main.cpp             # Entry point (for demo or server)
│   ├── Order.cpp
│   ├── Trade.cpp
│   ├── OrderBook.cpp
│   └── MatchingEngine.cpp
├── tests/                   # Unit & integration tests
│   ├── CMakeLists.txt
│   ├── test_order.cpp
│   ├── test_orderbook.cpp
│   └── test_matching_engine.cpp
├── benchmarks/              # (Optional) Performance benchmarks
│   └── orderbook_bench.cpp
├── scripts/                 # Helper scripts (deploy, run, generate data)
│   └── run_engine.sh
└── third_party/             # External libs (if vendored)

4️⃣ README.md Strategy

Keep a root README.md explaining the whole suite.

Each sub-project keeps its own README.md for details.

## Other project name options

Technical / Professional

MatchCore

TradeSync

OrderFlow

MatchEngineX

CoreMatcher

Finance-Oriented

EquiMatch (Equities + Match)

TradeMatrix

DealMatch

LiquidityLink

ExMatch (Exchange Match)

Powerful / Modern

SwiftMatch

PulseEngine

AtomicMatch

FlashMatcher

ZenithMatch

Minimal / Clean

OmniMatch

ClearMatch

Align

Nexa

Syntra


## C/C++
Not necessarily—but let’s break it down carefully.

C code in C++ compiler:

C++ is mostly backward-compatible with C. If you write plain C code and compile it with a C++ compiler, it will usually work.

The compiler might enforce stricter type checking and some small semantic differences, but basic code like loops, arithmetic, and functions usually behave the same.

Performance considerations:

For plain C code: A C++ compiler generally generates similar machine code as a C compiler. There’s no inherent slowdown just because it’s compiled as C++.

If you accidentally use C++ features: Things like new/delete, exceptions, std::vector, virtual functions, or RTTI can add overhead. But if you stick to C-style malloc/free and plain functions, there’s little to no difference.

Linkage differences: C++ name mangling can slightly affect linking, but this doesn’t change runtime speed.

Compiler flags matter more:

Optimization flags (-O2, -O3, -Ofast) have a bigger impact on speed than whether you compile as C or C++.

Using gcc for C vs g++ for C++ with the same flags will often produce almost identical machine code for pure C constructs.

✅ Conclusion: If your code is purely C, compiling with a C++ compiler usually does not make it slower. Performance differences only appear if you use C++-specific features or disable optimizations.

If you want, I can give a small example showing identical C code compiled with gcc vs g++ and compare assembly output to see how close they are. Do you want me to do that?



## How to manage .h files 
💡 Rule of Thumb:

Headers → minimal, only what’s needed.

CPP → include full headers.

Forward declare whenever possible.

Guard every header.



1. File Naming

Lowercase letters with underscores for readability.

Example: my_class.h, network_manager.cpp

Header files: .h

Source files: .cc (or .cpp in some cases)

Test files: end with _test.cc

Example: logger_test.cc

2. Folder Structure

Lowercase letters, no spaces.

Group by module or feature.

Example:

project/
    core/
        logger.h
        logger.cc
    network/
        network_manager.h
        network_manager.cc

3. Include Guards

Use all uppercase with underscores, based on full path.

Example:

#ifndef PROJECT_CORE_LOGGER_H_
#define PROJECT_CORE_LOGGER_H_

class Logger { ... };

#endif  // PROJECT_CORE_LOGGER_H_

4. Class Names

CamelCase, starting with uppercase.

Example: NetworkManager, HttpRequestHandler

5. Function & Variable Names

LowerCamelCase for functions and variables.

Example: connectToServer(), maxUsers

6. Constants

kPrefix with CamelCase

Example: const int kMaxRetries = 5;

7. Namespaces

Use all lowercase for namespaces.

Example:

namespace network {
class Socket { ... };
}

8. Test Naming

Test file: <module>_test.cc

Test case: TEST(ClassName, TestName)

Example:

TEST(Logger, LogMessage) {
  Logger logger;
  EXPECT_TRUE(logger.log("Hello"));
}

9. Header Includes

Include in this order:

Corresponding header (.h) first

Standard library headers

Third-party headers

Project headers

10. File Organization

Keep each class or module in one header + one source file.

Avoid multiple classes in a single file unless small and tightly coupled.

# Naming convention for files

✅ Rule of Thumb:

File name: lowercase_with_underscores

Class name: UpperCamelCase

Functions & variables: lowerCamelCase

Constants: k + UpperCamelCase

✅ Rule of Thumb

File names: lowercase with underscores, match class/module name.

Classes: UpperCamelCase, one main class per file.

Functions & variables: lowerCamelCase.

Constants: kPrefix + UpperCamelCase.

Tests: same module name with _test.cpp suffix.