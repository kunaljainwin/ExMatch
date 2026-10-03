# ExMatch Sprint Roadmap (Iterative Evolution)

**Philosophy:** Build like a real high-growth engineering company.  
Start with a clean, working prototype (MVP), verify behavior, then iteratively refactor, optimize, and scale across production sprints. Break every step into small, bite-sized tasks.

---

## Sprint 0: Foundation & Project Hierarchy (Completed)
- [x] Align directory hierarchy to `README.md` (`inc/core`, `src/core`, `tests`, `benchmarks`, `third_party`).
- [x] Move `matching_engine.cpp` to `src/core/`.
- [x] Establish Git commit standards and institutional engineering guidelines.
- [x] Establish research journal under `.agent/knowledge/research/`.

---

## Sprint 1: End-to-End Working Prototype (Current Sprint)
**Goal:** Build a clean, deterministic, functional in-memory Limit Order Book matching engine that compiles, runs, accepts orders, matches trades, and outputs order book state.

- **Story 1.1: Domain Entities (`inc/common/types.h`, `inc/core/order.h`, `inc/core/trade.h`)**
  - Clean representation of `Price`, `Quantity`, `OrderId`, `Side` (BUY, SELL), `OrderType` (LIMIT, MARKET).
  - Data contracts for `Order` and `Trade`.
- **Story 1.2: Order Book Prototype (`inc/core/order_book.h`, `src/core/order_book.cpp`)**
  - Maintain sorted bids (descending) and asks (ascending).
  - Implement price-time priority matching logic.
  - Generate execution trades for overlapping prices.
- **Story 1.3: Verification & Interactive Demonstration**
  - Write first unit test (`tests/order_book_test.cpp`).
  - Wire to `main.cpp` to verify end-to-end order entry and matching output.

---

## Sprint 2: Concurrency & Decoupled Architecture
**Goal:** Decouple order submission from the matching core using producer-consumer message queues.

- **Story 2.1:** Queue abstraction and SPSC ring buffer.
- **Story 2.2:** Single-writer matching engine thread consuming from ingress queue.
- **Story 2.3:** Output egress queue for trade events.

---

## Sprint 3: Low-Latency Optimization & Cache Architecture
**Goal:** Upgrade the working engine to institutional HFT performance standards.

- **Story 3.1:** Eliminate dynamic heap allocation in hot path (intrusive lists & order pools).
- **Story 3.2:** Power-of-2 bitwise masking and `alignas(64)` false sharing elimination in `LFQueue`.
- **Story 3.3:** CPU affinity (`pthread_setaffinity_np`) and core isolation.
- **Story 3.4:** Latency benchmarking (P50, P99, P99.9).

---

## Sprint 4: Observability, Logging & Failure Handling
**Goal:** Make the engine production-operable and resilient.

- **Story 4.1:** Asynchronous lock-free logger ring buffer (zero-overhead logging).
- **Story 4.2:** Failure mode mitigations (Queue saturation, zero liquidity market sweep).
- **Story 4.3:** Order cancellation ($O(1)$ lookup) and Cancel-on-Disconnect.

---

## Sprint 5: Gateway Interop (`ExchangeSimulator` Integration)
**Goal:** Bridge `ExMatch` to the multi-exchange simulation ecosystem.

- **Story 5.1:** Binary packet protocol serialization (`Packet.hpp`).
- **Story 5.2:** Adaptor connecting to `ExchangeSimulator`'s `trading_gateway`.

---

## Sprint 6: Monotonic Sequencing, Idempotency & WAL Replay
**Goal:** Guarantee strict total ordering, eliminate duplicate order submissions, and maintain an immutable write-ahead journal.

- **Story 6.1:** Lock-free atomic `Sequencer` assigning monotonically increasing 64-bit sequence numbers.
- **Story 6.2:** Bounded `IdempotencyTable` at ingress for `(clientId, clientOrderId)` deduplication.
- **Story 6.3:** Append-only binary Write-Ahead Log (`EventLog`) with sequential flush.
- **Story 6.4:** `DeterministicReplayer` verifying identical state reconstruction from an event stream.

---

## Sprint 7: Checksummed Snapshots & Crash Recovery
**Goal:** Implement point-in-time state snapshotting and verified crash recovery with sequence-gap detection.

- **Story 7.1:** `SnapshotManager` serializing order book state at sequence $N$ with CRC32/SHA-256 checksums.
- **Story 7.2:** Atomic snapshot file rotation and corrupted snapshot fallback.
- **Story 7.3:** `RecoveryCoordinator` orchestrating state restoration from snapshot $N$ and WAL replay from $N + 1$.
- **Story 7.4:** Sequence-gap detection in recovery replayer (halt on missing sequence).
- **Story 7.5:** Crash recovery integration test verifying zero state discrepancy.

---

## Sprint 8: Multi-Symbol Partitioning & Hot Standby Replication
**Goal:** Scale throughput horizontally across multiple instruments and achieve sub-millisecond failover.

- **Story 8.1:** `SymbolPartitionRouter` dispatching orders to isolated, core-pinned symbol matching engines.
- **Story 8.2:** Active-passive `StandbyEngine` continuously tailing the Event Log in memory.
- **Story 8.3:** Heartbeat monitoring and zero-downtime primary failover protocol.

