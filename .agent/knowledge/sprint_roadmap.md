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
