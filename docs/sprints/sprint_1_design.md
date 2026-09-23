# Sprint 1 Technical Design & Task Specifications

**Sprint:** 1 &mdash; In-Memory Limit Order Book Prototype (MVP)  
**Status:** In Progress  
**Objective:** Deterministic, in-memory matching engine supporting Limit orders, Price-Time priority matching, execution reports, and Level-2 depth inspection.

---

## Task 1.1: Core Financial Domain Primitives (`inc/common/types.h`)
- **Status:** COMPLETED (Commit `7f7e259`)
- **Deliverables:**
  - `Price`: Signed 64-bit integer (`int64_t`) representing ticks (fixed-point arithmetic).
  - `Quantity`, `OrderId`, `Timestamp`: Unsigned 64-bit integers (`uint64_t`).
  - `ClientId`: Unsigned 32-bit integer (`uint32_t`).
  - Scoped Enums (`: uint8_t`):
    - `Side` (`BUY = 0`, `SELL = 1`)
    - `OrderType` (`LIMIT = 0`, `MARKET = 1`)
    - `OrderStatus` (`NEW = 0`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`, `REJECTED`)
  - Zero-allocation string conversion utilities (`sideToString`, `orderStatusToString`, `orderTypeToString`).

---

## Task 1.2: Order & Trade Domain Entities (`inc/core/order.h`, `inc/core/trade.h`)
- **Status:** IN PROGRESS
- **Deliverables:**

### 1. `Order` Class (`inc/core/order.h`)
- **Attributes:**
  - `orderId_`: Unique 64-bit order sequence ID (immutable).
  - `clientId_`: Trading account ID (immutable).
  - `side_`: BUY or SELL (immutable).
  - `type_`: LIMIT or MARKET (immutable).
  - `price_`: Order price in ticks (immutable for limit orders).
  - `quantity_`: Total original quantity (immutable).
  - `filledQuantity_`: Executed volume (mutates upon matching).
  - `status_`: Order status lifecycle (`NEW` $\to$ `PARTIALLY_FILLED` $\to$ `FILLED` or `CANCELLED`).
  - `timestamp_`: Ingress timestamp in nanoseconds (immutable).
- **Core Invariants & Methods:**
  - `getRemainingQuantity() const noexcept` $\to$ `quantity_ - filledQuantity_`.
  - `isFilled() const noexcept` $\to$ `filledQuantity_ >= quantity_`.
  - `fill(Quantity fillQty) noexcept` $\to$ increments `filledQuantity_`, asserts `fillQty <= getRemainingQuantity()`, transitions status to `FILLED` or `PARTIALLY_FILLED`.
  - `cancel() noexcept` $\to$ sets status to `CANCELLED`.

### 2. `Trade` Struct (`inc/core/trade.h`)
- Plain-old-data execution report:
  - `tradeId`: Unique 64-bit execution sequence ID.
  - `makerOrderId`: ID of the resting order matched against.
  - `takerOrderId`: ID of the aggressive incoming order.
  - `price`: Executed price in ticks (determined by maker price).
  - `quantity`: Executed match quantity.
  - `timestamp`: Execution timestamp in nanoseconds.

---

## Task 1.3: Limit Order Book Matching Logic (`inc/core/order_book.h`, `src/core/order_book.cpp`)
- **Status:** PENDING
- **Deliverables:**
  - `OrderBook` class maintaining:
    - Bids: Sorted descending by price (`std::map<Price, std::vector<Order*>, std::greater<Price>>`).
    - Asks: Sorted ascending by price (`std::map<Price, std::vector<Order*>, std::less<Price>>`).
    - Fast order lookup: `std::unordered_map<OrderId, Order*>` for $O(1)$ lookup and cancellation.
  - Matching Loop Algorithm:
    - Incoming BUY order matches best ASKs while $\text{Best Ask Price} \le \text{Bid Price}$.
    - Incoming SELL order matches best BIDS while $\text{Best Bid Price} \ge \text{Sell Price}$.
    - FIFO priority: Orders at the same price level execute in the order they arrived.
    - Emits vector of `Trade` execution reports.
    - If incoming order has remaining unfilled quantity, it rests in the book.

---

## Task 1.4: Unit Tests & End-to-End Verification (`tests/order_book_test.cpp`, `src/main.cpp`)
- **Status:** PENDING
- **Deliverables:**
  - Test Case 1: Exact Limit Match (Buy 100 @ 15000 matches Sell 100 @ 15000).
  - Test Case 2: Partial Fill (Buy 100 @ 15000 matches Sell 40 @ 15000, 60 remains resting).
  - Test Case 3: Price-Time Priority (Two buys at same price level fill in exact arrival order).
  - Test Case 4: Order Cancellation (Order removed from book, depth updated).
  - Verification target in CMake (`ctest`).
