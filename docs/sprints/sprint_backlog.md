# ExMatch Sprint Backlog & Agile Roadmap

**Project:** `ExMatch` (Trading Suite – Institutional Limit Order Book)  
**Methodology:** Incremental Agile / SDLC evolution (Prototype MVP $\to$ Concurrency $\to$ Low-Latency Tuning $\to$ Resilience $\to$ Production Gateway).

---

## Sprint Board Overview

| Sprint | Focus Area | Status | Target Deliverable |
| :--- | :--- | :--- | :--- |
| **Sprint 0** | Foundation & Project Hierarchy | **COMPLETED** | Aligned folder structure, CMake targets, Git standards |
| **Sprint 1** | In-Memory Working Prototype (MVP) | **IN PROGRESS** | Deterministic Limit Order Book, Price-Time matching, unit tests |
| **Sprint 2** | Concurrency & SPSC Ring Buffers | PLANNED | Single-writer pinned core, lock-free queues, decoupled ingress/egress |
| **Sprint 3** | Low-Latency Optimization | PLANNED | Zero heap allocation, intrusive order lists, power-of-2 bitwise masking |
| **Sprint 4** | Observability & Production Resilience | PLANNED | Async zero-allocation logger, FMEA error handling, cancel-on-disconnect |
| **Sprint 5** | Exchange Gateway Interop | PLANNED | Binary packet protocol, `ExchangeSimulator` integration |

---

## Sprint 0: Foundation & Hierarchy (Completed)
- [x] **Task 0.1:** Reconcile repository hierarchy with `README.md` (`inc/core`, `src/core`, `tests`, `benchmarks`, `third_party`).
- [x] **Task 0.2:** Relocate `matching_engine.cpp` into `src/core/matching_engine.cpp`.
- [x] **Task 0.3:** Establish Conventional Git commit rules and zero-AI-noise standards (`.agent/knowledge/git_and_sdlc_standards.md`).
- [x] **Task 0.4:** Initialize research journal (`.agent/knowledge/research/`).

---

## Sprint 1: In-Memory Limit Order Book Prototype (Active Sprint)
**Goal:** Build a functional, deterministic in-memory order matching prototype that accepts Limit orders, maintains sorted Bids/Asks, matches trades according to Price-Time priority, and displays book depth.

### Story 1.1: Core Domain Primitives
- [ ] **Task 1.1.1:** Define fixed-point `Price` (`int64_t`), `Quantity` (`uint64_t`), `OrderId` (`uint64_t`), `ClientId` (`uint32_t`), `Timestamp` (`uint64_t`) in `inc/common/types.h`.
- [ ] **Task 1.1.2:** Define scoped enums: `Side` (BUY, SELL), `OrderType` (LIMIT, MARKET), `OrderStatus` (NEW, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED).
- [ ] **Task 1.1.3:** Provide string conversion helper utilities (`sideToString`, `orderStatusToString`) for logging and debugging.
*Acceptance Criteria:* Compiles under C++17 with `-Wall -Wextra`, zero warnings, no floating-point arithmetic.

### Story 1.2: Order & Trade Domain Entities
- [ ] **Task 1.2.1:** Create `inc/core/order.h` defining the `Order` entity (orderId, clientId, side, price, quantity, filledQuantity, status, timestamp).
- [ ] **Task 1.2.2:** Add remaining quantity helper (`remainingQuantity()`) and fill helper (`fill(Quantity qty)`).
- [ ] **Task 1.2.3:** Create `inc/core/trade.h` defining the `Trade` execution report entity (executionId, makerOrderId, takerOrderId, price, executedQuantity, timestamp).
*Acceptance Criteria:* Clean value semantics, immutable IDs, defensive assertions on overfill.

### Story 1.3: Limit Order Book Matching Logic
- [ ] **Task 1.3.1:** Create `inc/core/order_book.h` and `src/core/order_book.cpp`.
- [ ] **Task 1.3.2:** Implement Bid Book (sorted descending by price) and Ask Book (sorted ascending by price).
- [ ] **Task 1.3.3:** Implement price-time priority matching algorithm:
  - Incoming BUY matches resting ASKs with $\text{Ask Price} \le \text{Bid Price}$.
  - Incoming SELL matches resting Bids with $\text{Bid Price} \ge \text{Sell Price}$.
  - Support exact fills and partial fills.
  - Residual quantity of limit order rests in the book.
- [ ] **Task 1.3.4:** Add Level-2 snapshot inspector (`getBids()`, `getAsks()`) for book depth reporting.
*Acceptance Criteria:* Deterministic matching behavior; FIFO ordering preserved at identical price levels.

### Story 1.4: Unit Testing & End-to-End Verification
- [ ] **Task 1.4.1:** Create `tests/order_book_test.cpp` covering:
  - Exact match of single buy and sell order.
  - Partial fill with resting remainder.
  - Multiple order execution across multiple price levels.
  - Price-time priority verification at the same price level.
- [ ] **Task 1.4.2:** Update `order-matching-engine/src/main.cpp` to run an interactive demonstration verifying end-to-end functionality.
*Acceptance Criteria:* 100% test pass on CTest suite.

---

## Sprint 2: Concurrency & Lock-Free SPSC Ring Buffers
**Goal:** Decouple order submission from the core matching engine using lock-free Single-Producer Single-Consumer (SPSC) ring buffers.

- [ ] **Story 2.1:** Correct and complete `inc/common/lock_free_queue.hpp` (fix access specifiers, in-class initialization, power-of-2 bitwise mask).
- [ ] **Story 2.2:** Implement SPSC `enqueue()` and `dequeue()` with C++17 `acquire`/`release` memory barriers.
- [ ] **Story 2.3:** Add unit test `tests/lock_free_queue_test.cpp` verifying multi-threaded producer-consumer data integrity.
- [ ] **Story 2.4:** Spawn dedicated matching engine thread reading from Ingress SPSC Queue and emitting to Egress SPSC Queue.

---

## Sprint 3: Low-Latency Optimization & Cache Tuning
**Goal:** Optimize hot paths to institutional HFT benchmarks (sub-microsecond execution).

- [ ] **Story 3.1:** Eliminate false sharing in `LFQueue` via `alignas(64)` cache-line padding.
- [ ] **Story 3.2:** Implement intrusive doubly-linked order lists in price levels to eliminate dynamic heap allocations.
- [ ] **Story 3.3:** Replace order allocations with a pre-allocated `MemoryPool`.
- [ ] **Story 3.4:** Implement thread core pinning (`pthread_setaffinity_np`) in `src/common/thread.cpp`.
- [ ] **Story 3.5:** Create latency microbenchmark (`benchmarks/matching_benchmark.cpp`) reporting P50, P99, P99.9 latency.

---

## Sprint 4: Observability & Production Failure Handling
**Goal:** Add zero-allocation telemetry and implement FMEA resilience protections.

- [ ] **Story 4.1:** Implement asynchronous ring-buffer logger (`inc/common/logger.h`) decoupling terminal/disk I/O from the matching core.
- [ ] **Story 4.2:** Implement ingress queue saturation backpressure (`REJECTED_QUEUE_FULL`).
- [ ] **Story 4.3:** Implement $O(1)$ order cancellation lookup table and Cancel-on-Disconnect (COD) logic.
- [ ] **Story 4.4:** Add high-resolution execution timestamp metrics and telemetry.

---

## Sprint 5: Exchange Gateway & Protocol Integration
**Goal:** Bridge `ExMatch` directly into the `../ExchangeSimulator` multi-exchange environment.

- [ ] **Story 5.1:** Define binary packet protocol (`inc/protocol/packet.h`) matching `ExchangeSimulator/common/include/Packet.hpp`.
- [ ] **Story 5.2:** Connect `TradingGateway` transport to `ExMatch` ingress SPSC queue.
- [ ] **Story 5.3:** Run full end-to-end integration test with client simulator submitting trades through gateway router to `ExMatch`.
