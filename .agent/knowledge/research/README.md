# Low-Latency Systems & Financial Engineering Research Journal

This directory serves as the engineering knowledge base and research repository for `ExMatch`. Every critical architectural pattern, hardware optimization, and financial domain design decision is documented here with systems-level rigor.

---

## Index of Research Notes

| ID | Title | Key Systems Concepts | Status |
| :--- | :--- | :--- | :--- |
| [01](file:///home/turbo/side/ExMatch/.agent/knowledge/research/01_lock_free_spsc_ring_buffer.md) | **High-Performance SPSC Lock-Free Ring Buffer** | MESI Cache Coherence, False Sharing (`alignas(64)`), Bitwise Power-of-2 Masking, Acquire-Release Fences | Complete |
| 02 | **Memory Ordering & CPU Consistency Models** | Store Buffers, x86 TSO vs ARM Relaxed, Speculative Execution, Memory Barriers | Planned |
| 03 | **Fixed-Point Financial Arithmetic vs IEEE-754** | Binary Floating Point Rounding Artifacts, Fixed-Point Scaling, Sub-Penny Tick Precision | Planned |
| 04 | **Limit Order Book Data Structures & Intrusive Lists** | Memory Pool Allocation, Intrusive Doubly-Linked Lists, $O(1)$ Order Cancellation Hash Maps | Planned |
| 05 | **Zero-Allocation Asynchronous Ring-Buffer Logging** | Mutex I/O Jitter, Thread Core Pinning (`pthread_setaffinity_np`), Decoupled Logging | Planned |

---

## Architectural Principles (Per README.md Specification)

1. **Separation of Concerns:**
   - `inc/common/` & `src/common/`: Foundational systems, concurrency primitives, thread affinity, OS wrappers. Zero dependency on trading entities.
   - `inc/core/` & `src/core/`: Deterministic order matching state machine, order book, execution generation. Zero dependency on networking or UI.
   - `inc/cli/` & `src/cli/`: Interactive user interface, book visualizer, manual testing driver.
   - `inc/protocol/`: Wire protocol structures matching `../ExchangeSimulator` (`Packet.hpp`, `ErrorCodes.hpp`).
   - `tests/`: Automated unit tests (`<module>_test.cpp`) verified via CTest.
   - `benchmarks/`: Latency percentile (P50, P99, P99.9) and throughput microbenchmarks.

2. **C++17 Standards & Naming Conventions:**
   - File names: `lowercase_with_underscores.h` / `.cpp`.
   - Classes: `UpperCamelCase`.
   - Functions & variables: `lowerCamelCase`.
   - Constants: `kPrefix` + `UpperCamelCase` (e.g., `kCacheLineSize`).
   - Namespaces: `all_lowercase` (`common`, `core`, `client`).
   - Headers: Minimal includes, `#pragma once`, strict include ordering.
