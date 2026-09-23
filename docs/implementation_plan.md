# High-Performance Order Matching Engine (ExMatch) - Master Implementation Plan

Transform the current scaffolding of `ExMatch` into a complete, high-performance C++17 Limit Order Book (LOB) matching engine with lock-free concurrency primitives, zero-allocation asynchronous logging, an interactive TUI, and a comprehensive test suite.

---

## 1. Key Architectural Decisions

1. **Price Precision Standard:** Fixed-point 64-bit signed integers (`int64_t Price`, where `1 unit = 10^-4` or `0.0001` dollars/cents, allowing exact sub-penny representation) instead of floating-point numbers.
2. **Single-Threaded Engine Core:** Following standard institutional exchange architecture (e.g., LMAX Disruptor pattern), the matching engine core operates single-threaded on a dedicated, core-pinned thread reading from an SPSC lock-free ring buffer. This guarantees zero lock contention on the order book.
3. **Order Types in Scope for Initial Release:** Limit Order, Market Order, and Cancel Order. (IOC / FOK / Stop orders structured for subsequent additions).

---

## 2. Implementation Phases

The implementation is structured into **6 logical, sequential phases**:

---

### Phase 1: Core Concurrency & Systems Primitives

Establish thread-safe, lock-free, cache-aligned communication primitives with correct C++17 semantics.

* **[lock_free_queue.hpp](../order-matching-engine/inc/common/lock_free_queue.hpp)**
  - Add `public:` access specifier.
  - Fix in-class atomic initialization syntax (`read{0}`, `write{0}`).
  - Enforce power-of-two capacity for single-cycle bitwise masking (`& (capacity - 1)`).
  - Apply `alignas(64)` padding to prevent false sharing between producer and consumer cores.
  - Implement full `enqueue(const T&)` / `dequeue(T&)` methods with correct acquire-release memory order barriers.

* **[mutex_queue.hpp](../order-matching-engine/inc/common/mutex_queue.hpp)**
  - Add missing `#include <climits>`.
  - Replace dynamic node-allocating `std::queue` with a pre-allocated fixed-capacity circular buffer.
  - Add `std::condition_variable` support for efficient thread signaling without busy-wait throttling.

* **[thread.h](../order-matching-engine/inc/common/thread.h) & [thread.cpp](../order-matching-engine/src/common/thread.cpp)**
  - Implement `Thread` wrapper providing cross-platform CPU core pinning (thread affinity: `pthread_setaffinity_np` on Linux).

* **[project_defs.h](../order-matching-engine/inc/common/project_defs.h)**
  - Replace dangerous runtime `std::string` macro with a zero-allocation `constexpr` path-stripping function for `__FILE__`.

---

### Phase 2: Financial Domain Types & Models

Define cache-aligned, fixed-point financial domain primitives.

* **[types.h](../order-matching-engine/inc/common/types.h)**
  - Add `Price` (`int64_t`), `Quantity` (`uint64_t`), `OrderId` (`uint64_t`), `ClientId` (`uint32_t`), `Timestamp` (`uint64_t`).
  - Add enums: `Side { BUY, SELL }`, `OrderType { LIMIT, MARKET }`, `OrderStatus { NEW, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED }`.

* **`order.h` (`order-matching-engine/inc/core/order.h`)**
  - Define cache-optimized `Order` struct with intrusive doubly-linked list pointers (`prev`, `next`) for $O(1)$ FIFO queue operations.

* **`trade.h` (`order-matching-engine/inc/core/trade.h`)**
  - Define `Trade` execution report struct (ExecutionId, MakerOrderId, TakerOrderId, Price, Quantity, Timestamp).

---

### Phase 3: Limit Order Book & Matching Engine

Implement high-throughput price-time priority matching logic.

* **`limit_level.h` (`order-matching-engine/inc/core/limit_level.h`)**
  - Price level representation storing aggregated quantity and a doubly-linked list head/tail of FIFO orders.

* **`order_book.h` / `order_book.cpp` (`order-matching-engine/inc/core/order_book.h`, `src/core/order_book.cpp`)**
  - Two sorted order books: Bids (descending order) and Asks (ascending order).
  - Fast $O(1)$ order lookup table (`std::unordered_map<OrderId, Order*>` or pooled array) for instant cancellations.
  - Core functions: `addOrder()`, `cancelOrder()`, `getBestBid()`, `getBestAsk()`, `getSnapshot()`.

* **`matching_engine.h` / [matching_engine.cpp](../order-matching-engine/src/matching_engine.cpp)**
  - Price-time priority matching engine.
  - Match incoming taker orders against maker orders across price levels.
  - Handle exact fills, partial fills, market order sweep, and residual resting limit orders.
  - Emit `Trade` events onto an output SPSC ring buffer.

---

### Phase 4: Zero-Allocation Asynchronous Logging

Ensure high-throughput logging does not introduce jitter into the execution hot path.

* **[logger.h](../order-matching-engine/inc/common/logger.h) & [logger.cpp](../order-matching-engine/src/common/logger.cpp)**
  - Replace synchronous mutex printing with a lock-free ring buffer passing formatted or binary log events.
  - Background consumer thread for writing to console/file.
  - Implement high-resolution microsecond timestamps (`currentTimestamp`).

---

### Phase 5: Interactive Client / TUI Integration

Connect the matching engine to the CLI interface for live demonstration.

* **[client.h](../order-matching-engine/inc/cli/client.h) & [client.cpp](../order-matching-engine/src/cli/client.cpp)**
  - Wire `Client` to the `MatchingEngine` instance.
  - Add structured commands:
    - `BUY <qty> <price>`
    - `SELL <qty> <price>`
    - `MARKET_BUY <qty>` / `MARKET_SELL <qty>`
    - `CANCEL <orderId>`
    - `BOOK` (visual Level 2 order book snapshot)
  - Stream real-time trade execution confirmations.

* **[main.cpp](../order-matching-engine/src/main.cpp)**
  - Initialize configuration, queues, background logger, and launch the client TUI.

---

### Phase 6: Build Modernization, Unit Tests & Benchmarks

* **[CMakeLists.txt](../order-matching-engine/CMakeLists.txt)**
  - Modernize to target-based commands (`target_include_directories`, `target_compile_definitions`, `target_link_libraries`).
  - Link `Threads::Threads`.
  - Add test and benchmark targets.

* **`tests/test_order_book.cpp`**
  - Test cases for exact limit matches, partial fills, price-time priority FIFO ordering, cancellations, and market sweeps.

* **`benchmarks/queue_benchmark.cpp`**
  - Throughput and latency comparison between `LFQueue` (lock-free) and `LQueue` (mutex).

---

## 3. Verification Plan

### Automated Tests
1. **Compilation & Warning Verification:**
   ```bash
   cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
   cmake --build build -- -j$(nproc)
   ```
2. **Unit Test Execution:**
   ```bash
   ctest --test-dir build --output-on-failure
   ```
3. **Microbenchmarks:**
   ```bash
   ./build/order-matching-engine/benchmarks/queue_benchmark
   ```

### Manual Verification
1. Run `./build/order-matching-engine/order_matching_engine`.
2. Enter sequential orders in the TUI:
   * `BUY 100 @ 150.00`
   * `BUY 50 @ 150.00` (test FIFO queueing)
   * `SELL 120 @ 150.00` (verify partial fill of first order and full fill of second order)
3. Display order book using `BOOK` and confirm exact remaining depth (30 shares at 150.00).
