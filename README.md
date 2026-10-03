# Trading Suite – Order Matching Engine

The High-performance **Order Matching Engine** implemented in modern C++17.  
It simulates the core of a stock exchange by managing order books, matching buy and sell orders, and executing trades in real-time.

## Key Features
- **Limit Order Book (LOB)** with deterministic price-time priority matching.
- **Single-Writer In-Memory Architecture**: Lock-free, wait-free execution path on dedicated CPU cores.
- **Horizontal Scaling via Symbol Partitioning**: Independent order books partitioned across isolated engine workers.
- **Monotonic 64-bit Event Sequencing**: Strict total ordering independent of non-monotonic wall-clock jitter.
- **Durable Append-Only Event Log (WAL)**: Fast sequential audit journal for event streaming and deterministic replay.
- **Point-in-Time Checksummed Snapshots**: Fast crash recovery with sequence-gap detection ($O(\text{replay window})$).
- **Gateway Idempotency Filter**: Client-scoped deduplication (`clientOrderId`) preventing duplicate executions.
- **Hot Standby Active-Passive Replication**: Real-time shadow replay for sub-millisecond failover.
- **Order Types**: Limit, Market (extendable to Stop, IOC, GTC).
- **Text-based UI (TUI)** for interactive testing.
- **Cross-platform Build** using CMake.
- **Unit Testing** for core modules.

## Technical Highlights
- **The 8 Core Pillars**: `In-memory → Single writer → Partition → Sequence → Event log → Snapshot → Replay → Deterministic`.
- **Strict Non-Hot-Path Redis Boundary**: Hot matching executes exclusively in RAM; external caching is restricted to non-hot-path metadata.
- **Clean folder structure** with `inc/`, `src/`, `common/`, `core/`, `cli/`, `tests/`, `benchmarks/`.
- **Modern C++17 systems programming**: Fixed-point tick arithmetic (`int64_t Price`), cache-line alignment (`alignas(64)`), RAII, intrusive data structures.
- **Lock-Free Concurrency**: SPSC ring buffers with C++17 `acquire`/`release` memory barriers and power-of-two bitwise masking.
- **Zero-Allocation Async Logging**: Ring-buffer logger decoupling terminal/disk I/O from the matching hot path.


## Purpose
This project demonstrates:
- **Systems-level programming** in C++  
- **Low-latency, high-throughput design**  
- **Professional software engineering practices**, including modularity, testing, and build automation  

It is ideal as a **portfolio project** to showcase skills relevant for fintech, trading platforms, or high-performance backend systems.

## Folder Structure

```
C:.
│   .gitattributes
│   .gitignore
│   CMakeLists.txt
│   LICENSE
│   README.md
├───build
└───order-matching-engine
    │   CMakeLists.txt
    │
    ├───benchmarks
    ├───build
    ├───docs
    ├───inc
    │   ├───cli
    │   │       client.h
    │   │
    │   ├───common
    │   │       common.h
    │   │       logger.h
    │   │       project_defs.h
    │   │       std_libs.h
    │   │       types.h
    │   │       utils.h
    │   │
    │   └───core
    ├───scripts
    │       build.bat
    │       build.sh
    │
    ├───src
    │   │   main.cpp
    │   │   matching_engine.cpp
    │   │
    │   ├───cli
    │   │       client.cpp
    │   │
    │   └───common
    │           logger.cpp
    │
    ├───tests
    └───third_party
```
# Developer Guide – Trading Suite / Order Matching Engine

This guide helps developers **set up, build, and contribute** to the Trading Suite project.

---

## 1. Prerequisites

- **C++ Compiler**: GCC >= 10 or MSVC >= 2019  
- **CMake**: >= 3.16  
- **Git**: for version control and submodules  
- Optional: **Make / Ninja** (for faster builds on Linux/macOS)

---

## 2. Clone Repository

```bash
git clone --recurse-submodules https://github.com/kunaljainwin/ExMatch.git
cd ExMatch
```
## 3. Build Project

```bash
cd order-matching-engine

mkdir -p build
cd build

# Linux/macOS
../scripts/build.sh

# Windows (from PowerShell or cmd)
../scripts/build.bat

```

# Research for Decisions

4️⃣ README.md Strategy

- Keep a root README.md explaining the whole suite.

- Each sub-project keeps its own README.md for details.

## Other project name options
- MatchCore, TradeSync, OrderFlow, MatchEngineX, CoreMatcher, Finance-Oriented, EquiMatch, TradeMatrix, DealMatch, LiquidityLink, ExMatch, SwiftMatch, PulseEngine, AtomicMatch, FlashMatcher, ZenithMatch, OmniMatch, ClearMatch, Align, Nexa, Syntra

## C  vs C++ Decision
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
- 💡 Rule of Thumb:

- Headers → minimal, only what’s needed.

- CPP → include full headers.

- Forward declare whenever possible.

- Guard every header with #pragma once



1. File Naming

- Lowercase letters with underscores for readability.

Example: my_class.h, network_manager.cpp

Header files: .h

Source files: .cc (or .cpp in some cases)

Test files: end with _test.cc

Example: logger_test.cc_

2. Folder Structure

- Lowercase letters, no spaces.

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


## ✅ Rule of Thumb

- File names: lowercase with underscores, match class/module name.

- Classes: UpperCamelCase, one main class per file.

- Functions & variables: lowerCamelCase.

- Constants: kPrefix + UpperCamelCase.

- Tests: same module name with _test.cpp suffix.