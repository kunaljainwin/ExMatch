# High-Performance Order Matching Engine (ExMatch) - Master Implementation Plan

Transform the current scaffolding of `ExMatch` into a complete, high-performance C++17 Limit Order Book (LOB) matching engine with lock-free concurrency primitives, zero-allocation asynchronous logging, an interactive TUI, and a comprehensive test suite.

---

## 1. Key Architectural Decisions

1. **Price Precision Standard:** Fixed-point 64-bit signed integers (`int64_t Price`, where `1 unit = 10^-4` or `0.0001` dollars/cents, allowing exact sub-penny representation) instead of floating-point numbers.
2. **Single-Writer In-Memory Core:** The matching engine hot path executes strictly in-memory on a dedicated core-pinned thread reading from an SPSC lock-free ring buffer. Zero lock contention, zero OS context switches, and zero network/database I/O on the matching path.
3. **Strict Non-Hot-Path Boundary for Redis:** Redis or external network caches are prohibited on the matching hot path to prevent serialization and network jitter. Redis is strictly relegated to non-hot-path roles (gateway idempotency tokens, user sessions, configuration metadata).
4. **Horizontal Scaling via Symbol Partitioning:** Independent symbols (`BTC-USD`, `ETH-USD`) are partitioned across isolated single-writer matching engines. Intra-book execution preserves strict single-threaded total ordering.
5. **Monotonic Event Sequencing:** Every accepted event is stamped with a strictly increasing 64-bit sequence number, establishing a total order independent of wall-clock jitter.
6. **Append-Only Event Log (WAL) & Deterministic State Machine:** All mutations write to a durable append-only journal. Given the identical sequence of inputs, the engine deterministically reproduces identical order books and trade executions.
7. **Periodic Snapshots with Gap-Free Recovery:** Checksummed state snapshots are saved at sequence $N$. Recovery loads snapshot $N$, streams event log from $N+1$, enforces sequence continuity (halting on gaps), and resumes execution.
8. **Hot Standby Engine:** Standby engine continuously replays the event log in shadow mode for instant failover without cold restart latency.
9. **Order Types in Scope:** Limit Order, Market Order, and Cancel Order (IOC / FOK / Stop orders structured for subsequent additions).

---

## 2. Implementation Phases

The implementation is structured into **10 logical, sequential phases**:

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
  - Add `Price` (`int64_t`), `Quantity` (`uint64_t`), `OrderId` (`uint64_t`), `ClientId` (`uint32_t`), `Timestamp` (`uint64_t`), `SequenceNum` (`uint64_t`).
  - Add enums: `Side { BUY, SELL }`, `OrderType { LIMIT, MARKET }`, `OrderStatus { NEW, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED }`.

* **`order.h` (`order-matching-engine/inc/core/order.h`)**
  - Define cache-optimized `Order` struct with intrusive doubly-linked list pointers (`prev`, `next`) for $O(1)$ FIFO queue operations.

* **`trade.h` (`order-matching-engine/inc/core/trade.h`)**
  - Define `Trade` execution report struct (ExecutionId, MakerOrderId, TakerOrderId, Price, Quantity, Timestamp, SequenceNum).

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

### Phase 7: Event Sequencing, Idempotency & Deduplication Engine

Ensure duplicate requests are safely rejected and all mutations are strictly ordered.

* **`idempotency_table.h` (`order-matching-engine/inc/core/idempotency_table.h`)**
  - In-memory bounded cache tracking `(clientId, clientOrderId) -> OrderResponse`.
  - Fast reject of retransmitted/duplicate client submissions without triggering matching logic.

* **`sequencer.h` (`order-matching-engine/inc/core/sequencer.h`)**
  - Lock-free monotonic 64-bit sequence generator stamping every accepted ingress event.
  - Guaranteed gapless sequence numbering for strict total order.

---

### Phase 8: Append-Only Event Log (WAL) & Deterministic Replay

Provide durable event history and replay capability.

* **`event_log.h` / `event_log.cpp` (`order-matching-engine/inc/core/event_log.h`, `src/core/event_log.cpp`)**
  - High-throughput append-only binary journal writing events (`NEW_ORDER`, `CANCEL_ORDER`, `TRADE_EXECUTION`).
  - Memory-mapped file (mmap) or asynchronous background disk flushing.
  - Read stream API supporting range scans: `readEvents(fromSequence, toSequence)`.

* **`deterministic_replayer.h` (`order-matching-engine/inc/core/deterministic_replayer.h`)**
  - Replays historical event streams against a clean `OrderBook` instance.
  - Verifies that replay produces exact identical state and trade outputs.

---

### Phase 9: State Snapshotting, Checksum Verification & Gap-Detection Recovery

Guarantee rapid, verified recovery following crash or restart.

* **`snapshot_manager.h` / `snapshot_manager.cpp` (`order-matching-engine/inc/core/snapshot_manager.h`)**
  - Periodic serialization of full order book depth tagged with snapshot sequence $N$.
  - Generates CRC32/SHA-256 checksums to detect disk corruption.
  - Atomic rotation: writes to temporary file and renames upon checksum verification.

* **`recovery_coordinator.h` (`order-matching-engine/inc/core/recovery_coordinator.h`)**
  - 10-step recovery orchestrator:
    1. Stop/drain ingress traffic.
    2. Load latest verified snapshot file.
    3. Verify snapshot checksum; fallback to preceding snapshot if corrupt.
    4. Reconstruct order book state at sequence $N$.
    5. Replay WAL events starting strictly from $N + 1$.
    6. **Sequence-gap detection**: Halt if $\text{seq}_{i} \ne \text{seq}_{i-1} + 1$.
    7. Complete replay to latest sequence.
    8. Mark matching engine state as `READY`.
    9. Resume ingress order processing.

---

### Phase 10: Multi-Symbol Partitioning Router & Hot Standby Replication

Scale throughput across multiple instruments and achieve near-zero RTO failover.

* **`symbol_partition_router.h` (`order-matching-engine/inc/core/symbol_partition_router.h`)**
  - Gateway routing orders to symbol-specific single-writer matching engines (`BTC`, `ETH`, `SOL`).
  - Zero cross-thread communication between distinct symbol partitions.

* **`standby_engine.h` (`order-matching-engine/inc/core/standby_engine.h`)**
  - Shadow matching engine continuously tailing the active Event Log in memory.
  - Instantaneous primary takeover upon heartbeat failure without cold snapshot loading.

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
3. **Idempotency & Sequence Continuity Tests:**
   - Verify duplicate `clientOrderId` rejections.
   - Verify monotonic sequence generator under burst concurrency.
4. **Recovery & Sequence-Gap Detection Tests:**
   - Inject simulated crash at sequence $N + 500$; verify full state recovery from snapshot $N$.
   - Inject artificial sequence gap ($1002 \to 1005$); verify recovery halts defensively.
5. **Microbenchmarks:**
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
4. Trigger manual snapshot and replay to verify state consistency.

