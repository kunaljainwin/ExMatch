# High-Throughput Order & Trade Processing Architecture

A systems architecture specification for `ExMatch`, formalizing the principles of deterministic, low-latency, fault-tolerant order matching and event streaming.

---

## 1. Core Principles: The 8 Pillars

```text
In-memory ──► Single writer ──► Partition ──► Sequence ──► Event log ──► Snapshot ──► Replay ──► Deterministic
```

| Pillar | Architectural Role | Systems Guarantee |
| :--- | :--- | :--- |
| **In-Memory** | Limit order book state resides exclusively in RAM | Sub-microsecond matching latency; zero disk, network, or DB calls on the hot path |
| **Single Writer** | Exactly one thread owns and mutates an order book | Zero mutex contention, zero lock overhead, lock-free wait-free execution |
| **Partition** | Scale horizontally by partitioning independent symbols | Linear horizontal scaling across instruments; isolated fault domains |
| **Sequence** | Monotonically increasing 64-bit sequence numbers per event | Strict total ordering independent of non-monotonic wall-clock jitter |
| **Event Log** | Durable append-only journal of all ingress/egress events | Immutable audit trail answering "what happened" for recovery and streaming |
| **Snapshot** | Periodic point-in-time serialization of book state at sequence $N$ | Bounded crash recovery time; baseline state answering "what was state at $N$" |
| **Replay** | Fast-forward state from snapshot sequence $N+1$ to latest | Rapid state reconstruction with sequence-gap detection and checksum verification |
| **Deterministic** | Pure state machine behavior given identical sequence input | Identical state and trade generation during normal execution, recovery, and standby |

---

## 2. End-to-End System Topology

```text
                          +-------------------------+
                          |   Clients / Traders     |
                          +------------+------------+
                                       |
                                       v
                          +-------------------------+
                          |   Gateway / Ingestion   |
                          | (Binary / FIX Protocol) |
                          +------------+------------+
                                       |
                                       v
                          +-------------------------+
                          | Validation & Idempotency|
                          |  (clientOrderId dedup)  |
                          +------------+------------+
                                       |
                                       v
                          +-------------------------+
                          | Symbol Partition Router |
                          +----+-------+-------+----+
                               |       |       |
                 +-------------+       |       +-------------+
                 |                     |                     |
                 v                     v                     v
        +-----------------+   +-----------------+   +-----------------+
        | Engine 1 (BTC)  |   | Engine 2 (ETH)  |   | Engine 3 (SOL)  |
        | Single-Writer   |   | Single-Writer   |   | Single-Writer   |
        | In-Memory Book  |   | In-Memory Book  |   | In-Memory Book  |
        +--------+--------+   +--------+--------+   +--------+--------+
                 |                     |                     |
                 +-------------+       |       +-------------+
                               |       |       |
                               v       v       v
                          +-------------------------+
                          | Append-Only Event Log   |
                          |  (Durable WAL Journal)  |
                          +----+---------------+----+
                               |               |
                 +-------------+               +-------------+
                 |                                           |
                 v                                           v
    +-------------------------+                 +-------------------------+
    | Downstream Consumers    |                 | Hot Standby Engine      |
    | (Market Data, Clearing, |                 | (Continuous Replay,     |
    |  Analytics, Cold Store) |                 |  Instant Failover)      |
    +-------------------------+                 +-------------------------+
```

---

## 3. Order Book & Matching Hot Path

### 3.1 In-Memory Price-Time Priority
* **Bid Book:** Descending price order (`std::greater<Price>`).
* **Ask Book:** Ascending price order (`std::less<Price>`).
* **Level Queue:** FIFO doubly-linked intrusive order list per price level.
* **Fast Lookup:** $O(1)$ order index table (`OrderId -> Order*`) for instant cancellations.

### 3.2 Prohibited Hot-Path Dependencies: Why Not Redis?
* Directing matching operations through Redis or any network store adds:
  1. Serialization / deserialization CPU overhead.
  2. TCP/IPC network stack traversal ($50\text{--}500\,\mu\text{s}$ latency floor).
  3. External network/connection failure dependency on the matching hot path.
* **Design Rule:** The hot path is strictly in-process and in-memory. Redis is restricted strictly to non-hot-path roles:
  - Gateway-level idempotency token caching.
  - User session authentication and permission caching.
  - Non-critical metadata and reference data distribution.

---

## 4. Concurrency & Partitioning Model

### 4.1 Single-Writer Principle
* Each order book is owned by exactly **one core-pinned thread**.
* No mutexes, condition variables, or rwlocks guard the order book.
* Ingress requests arrive via lock-free Single-Producer Single-Consumer (SPSC) ring buffers.
* Egress execution reports and market data events depart via lock-free SPSC ring buffers.
* Ancillary concerns (persistence, market data fan-out, compliance logging, risk aggregation) run asynchronously on separate threads or separate processes.

### 4.2 Horizontal Scaling via Symbol Partitioning
* Scaling is achieved by assigning independent symbols to independent engine instances:
  - `Engine 1` $\to$ `BTC-USD`
  - `Engine 2` $\to$ `ETH-USD`
  - `Engine 3` $\to$ `SOL-USD`
* Routing from ingress gateway to engine is deterministic based on symbol hashing or static lookup.
* **Scaling Constraint:** A single extremely hot symbol cannot be partitioned across multiple cores without sacrificing strict deterministic price-time ordering. Scaling a single symbol requires algorithmic and hardware optimizations (cache alignment, zero allocation, SIMD, core pinning), not naive threading.

---

## 5. Idempotency & Monotonic Sequencing

### 5.1 Idempotency Guarantee
* Network retries and client reconnections can produce duplicate order submissions.
* Every order submission carries a client-scoped `clientOrderId` alongside `clientId`.
* The Gateway Ingestion layer maintains a deduplication state table:
  - If `(clientId, clientOrderId)` is already processed, return previous acknowledgment/rejection without re-matching.
  - Eliminates accidental double-fills or duplicate cancellations.

### 5.2 Monotonic Sequence Numbers
* Clock timestamps are subject to NTP drift, clock skew, and resolution limits.
* Every accepted event is assigned an atomically generated, monotonically increasing 64-bit sequence number:
  ```text
  1001 -> NEW_ORDER   (OrderId: 101, Symbol: BTC-USD, Buy 1.0 @ 50000)
  1002 -> NEW_ORDER   (OrderId: 102, Symbol: BTC-USD, Sell 0.5 @ 50000)
  1003 -> TRADE       (TradeId: 501, Maker: 101, Taker: 102, Qty: 0.5, Price: 50000)
  1004 -> CANCEL      (OrderId: 101, Symbol: BTC-USD)
  ```
* The sequence number defines the **exact total ordering** of the matching engine state machine.

---

## 6. Durable Event Log & Periodic Snapshotting

### 6.1 Append-Only Event Log (WAL)
* All state mutations are written sequentially to an append-only durable event log.
* The event log provides the complete, authoritative history of the engine:
  - High-throughput sequential disk writes (NVMe SSD).
  - Group-commit / batched flushing to balance durability and latency.

### 6.2 Periodic State Snapshots
* To prevent replaying millions of historical events on recovery, the engine creates periodic snapshots of complete order book state.
* Each snapshot captures:
  1. `snapshotSequence`: The exact event sequence number $N$ up to which all mutations are applied.
  2. `timestamp`: Nanosecond epoch of snapshot generation.
  3. `bookState`: All resting Bids and Asks across all price levels with order queues.
  4. `checksum`: CRC32 or SHA-256 integrity hash of the snapshot payload.
* Snapshots are written atomically using rename semantics (`snapshot_temp.bin` $\to$ `snapshot_<seq>.bin`).
* **Safety Rule:** Multiple rolling snapshots are preserved. Older event log segments are archived only after a snapshot is fully verified on disk. Never delete event logs solely because snapshot creation has commenced.

---

## 7. Deterministic Recovery & Gap-Free Replay

### 7.1 Recovery Algorithm
When an engine restarts following an abnormal termination:

```text
               +----------------------------------+
               | 1. Stop / Reject Ingress Traffic |
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               | 2. Locate Latest Snapshot File   |
               +----------------+-----------------+
                                |
                                v
               +----------------------------------+
               | 3. Verify Checksum & Integrity   |
               +-------+------------------+-------+
                       |                  |
                    Valid               Corrupt
                       |                  |
                       v                  v
    +-------------------------+     +-------------------------+
    | 4. Load State at Seq N  |     | Fallback to Previous    |
    +------------+------------+     | Valid Snapshot N_prev   |
                 |                  +------------+------------+
                 v                               |
    +--------------------------------------------+
    | 5. Stream Event Log from Sequence N + 1    |
    +------------+-------------------------------+
                 |
                 v
    +--------------------------------------------+
    | 6. Validate Monotonic Sequence Continuity  |
    +-------+----------------------------+-------+
            |                            |
        Contiguous                      Gap
            |                            |
            v                            v
    +-------------------------+     +-------------------------+
    | 7. Deterministic Replay |     | HALT & Request Missing  |
    |    State Reconstructed  |     | Events from Log Store   |
    +------------+------------+     +-------------------------+
                 |
                 v
    +-------------------------+
    | 8. Verify State Hash    |
    +------------+------------+
                 |
                 v
    +-------------------------+
    | 9. Mark Engine READY    |
    +------------+------------+
                 |
                 v
    +-------------------------+
    | 10. Open Ingress Flow   |
    +-------------------------+
```

### 7.2 Sequence-Gap Detection Rule
* During replay, every event must strictly satisfy:
  $$\text{Expected Sequence} = \text{Previous Sequence} + 1$$
* If an event sequence jumps (e.g., $1002 \to 1005$):
  - **Do NOT proceed.** A missing event compromises state correctness and balance integrity.
  - The engine must halt recovery, alert operations, and fetch missing event payloads from secondary log replicas before resuming.

---

## 8. Hot Standby & Fast Failover

* For near-zero Recovery Time Objective (RTO):
  - **Primary Engine:** Actively accepts ingress orders, matches, publishes events to the Event Log.
  - **Standby Engine:** Runs as an active shadow consumer, continuously tailing the Event Log and executing deterministic replay in lockstep.
* Upon primary failure detection (heartbeat timeout):
  1. Standby verifies that it has caught up to the latest sequence in the log.
  2. Standby transitions state to `PRIMARY`.
  3. Gateway shifts symbol ingress traffic to the new Primary.
  4. Failover completes in milliseconds without rebuilding from cold snapshots.

---

## 9. Latency vs. Durability Trade-Offs

| Strategy | Persistence Model | Typical Latency | Durability Guarantee | Recovery Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Fully Synchronous WAL** | `fsync()` on every order | $10\text{--}100\,\mu\text{s}$ | Zero data loss on sudden power cutoff | Low (log strictly up to date) |
| **Batched / Group Commit** | Background micro-batch flush ($<1\,\text{ms}$) | $< 1\,\mu\text{s}$ matching; async persistence | Bounded loss window ($< 1\,\text{ms}$) | Medium |
| **Replicated In-Memory Standby** | Network replication to hot standby in RAM | $5\text{--}15\,\mu\text{s}$ | Resilient to single-node machine death | Low failover latency |

---

## 10. The 60-Second Architectural Summary

> Partition orders by symbol so each matching engine owns an independent order book. The order book stays entirely in memory with a single-writer thread to eliminate locks and synchronization latency. Every accepted order is assigned a monotonically increasing sequence number and committed to a durable append-only event log. Periodically, the engine takes a consistent, checksummed snapshot of book state tagged with the exact sequence number. On failure, the engine loads the latest verified snapshot and deterministically replays events from sequence $N+1$, enforcing sequence continuity without gaps. For near-instant failover, a hot standby engine continuously replays the event log. Idempotency is enforced at ingress via client order IDs.
