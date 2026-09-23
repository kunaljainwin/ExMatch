# Research Note 01: High-Performance SPSC Lock-Free Ring Buffer

**Domain:** Low-Latency Systems Architecture & High-Frequency Trading (HFT)  
**Target:** `ExMatch` Core Ingress/Egress Concurrency  
**Author / Engineering Journal**  

---

## 1. Abstract & Motivation

In institutional exchange architectures (e.g., LMAX Disruptor, Nasdaq INET, CME Globex), incoming orders must travel from network gateways (Trading Gateways / FIX Parsers) to the matching engine core with the lowest and most deterministic latency possible.

Traditional multi-threaded concurrency using OS synchronization primitives (`std::mutex`, `std::unique_lock`, `pthread_mutex_t`) fails under ultra-low-latency requirements:
1. **OS Kernel Context Switches:** When a thread blocks on an un-acquired mutex, the OS scheduler puts it to sleep and yields the CPU core. Waking that thread back up incurs an OS context switch penalty of **1,000 to 5,000 nanoseconds (1–5 µs)**.
2. **Priority Inversion & Jitter:** Mutexes introduce unpredictable tail latency (P99, P99.9), unacceptable in competitive execution.
3. **Cache Invalidation:** Locking mechanisms invalidate processor cache lines across cores.

The Single-Producer Single-Consumer (SPSC) ring buffer guarantees **wait-free bounded execution** (every operation completes in a finite number of CPU cycles, typically $< 10$ ns) without taking any kernel locks.

---

## 2. Hardware Architecture & CPU Cache Mechanics

To write optimal low-latency code, one must understand how modern multi-core x86-64 and ARM processors manage memory.

### 2.1 Cache Hierarchy & The 64-Byte Cache Line
CPUs do not read or write single bytes to system RAM. Instead, memory is transferred between RAM and the processor caches (L3, L2, L1) in discrete **64-byte chunks** known as **cache lines**.

```
+-------------------------------------------------------------+
|                      CPU Core 1 (Producer)                   |
|  Registers -> L1 Data Cache (32KB) -> L2 Cache (512KB)      |
+------------------------------┬------------------------------+
                               │
                       [Interconnect Bus]
                 (MESI Cache Coherence Protocol)
                               │
+------------------------------┴------------------------------+
|                      CPU Core 2 (Consumer)                   |
|  Registers -> L1 Data Cache (32KB) -> L2 Cache (512KB)      |
+-------------------------------------------------------------+
                               │
                 Shared L3 Cache (16MB - 64MB)
                               │
                          Main RAM
```

### 2.2 The False Sharing Catastrophe
Consider this naive queue declaration:

```cpp
template <typename T>
class NaiveQueue {
    std::atomic<size_t> write_idx_{0}; // 8 bytes
    std::atomic<size_t> read_idx_{0};  // 8 bytes
    // Both variables fit inside the SAME 64-byte cache line!
};
```

1. Core 1 (Producer) updates `write_idx_`.
2. Under the **MESI cache coherence protocol**, Core 1 marks its cache line as **Modified (M)** and broadcasts an Invalidation message across the interconnect bus.
3. Core 2's cache line containing `read_idx_` is immediately marked **Invalid (I)**.
4. When Core 2 tries to read or update `read_idx_`, it suffers a **cache miss** and must stall while fetching the cache line again from Core 1 / L3 cache.
5. When Core 2 updates `read_idx_`, the reverse occurs, invalidating Core 1's cache line.

This phenomenon is **False Sharing** (or cache-line ping-pong). It turns a lock-free queue into a major performance bottleneck, degrading throughput by **10x to 50x**.

### 2.3 The Architectural Remedy: `alignas(64)`
We force each atomic index onto its own dedicated 64-byte cache line using C++17 `alignas`:

```cpp
constexpr size_t CACHE_LINE_SIZE = 64;

// Isolated on Cache Line A
alignas(CACHE_LINE_SIZE) std::atomic<size_t> write_idx_{0};

// Isolated on Cache Line B
alignas(CACHE_LINE_SIZE) std::atomic<size_t> read_idx_{0};
```
Now, Core 1 writes exclusively to Cache Line A, and Core 2 writes exclusively to Cache Line B. Neither core invalidates the other's cache line during writes.

---

## 3. Instruction Pipeline & Memory Consistency Models

Modern superscalar processors feature out-of-order execution pipelines, branch predictors, and store buffers. 

### 3.1 The Reordering Hazard
Suppose the producer executes:
```cpp
buffer_[write_idx] = order;   // Store Payload
write_idx.store(next_write);  // Store Index
```
Without strict memory fences, the compiler or CPU store buffer can reorder these two writes. If `write_idx` is published before the order payload is committed to memory, the consumer thread on Core 2 will read uninitialized memory (garbage/dangling pointers).

### 3.2 C++17 Memory Ordering Contract
C++17 provides fine-grained control over memory fences through `std::memory_order`:

| Memory Order | Role in SPSC Queue | Mechanics |
| :--- | :--- | :--- |
| `std::memory_order_relaxed` | Reading own thread's state | Guarantees atomic read/write, but no synchronization or ordering constraints. Fastest possible atomic operation. |
| `std::memory_order_release` | Publishing data (`store`) | Ensures **all preceding memory writes** in the current thread are committed and visible to other threads *before* this atomic store takes effect. Prevents store-store reordering. |
| `std::memory_order_acquire` | Consuming data (`load`) | Ensures **no subsequent memory reads/writes** in the current thread can be speculatively reordered *before* this atomic load. Synchronizes with the corresponding `release`. |
| `std::memory_order_seq_cst` | Default (Too Slow) | Enforces total sequential consistency globally. Introduces heavy memory bus locks on x86 (`mfence` or locked instructions). **Never use in HFT hot paths.** |

### 3.3 The SPSC Acquire-Release Protocol
```
Producer Thread (Core 1)                   Consumer Thread (Core 2)
────────────────────────                   ────────────────────────
1. Write payload into buffer_[idx]
2. write_idx_.store(idx + 1, RELEASE) ───► 1. write_idx_.load(ACQUIRE)
                                            2. Read payload from buffer_[idx]
                                            3. read_idx_.store(idx + 1, RELEASE)
```
- The `release` store on the producer synchronizes-with the `acquire` load on the consumer.
- The consumer is mathematically guaranteed to see the payload written in step 1.

---

## 4. Arithmetic Optimization: Power-of-2 Bitwise Masking

In a circular ring buffer, index increments must wrap around to 0 when reaching the end of the buffer.

### 4.1 Modulo Division (`%`)
```cpp
idx = (idx + 1) % capacity;
```
On x86-64 processors, the `idiv` (integer division) instruction is not pipelined and takes **10 to 25 CPU clock cycles**. On a matching engine processing millions of orders per second, modulo division consumes measurable latency.

### 4.2 Bitwise Masking (`&`)
If `capacity` is constrained to a power of two ($C = 2^N$):
$$\text{capacity} - 1 = \underbrace{000\dots01111_2}_{N \text{ ones}}$$
Wrapping an index around is computed using a bitwise AND:
```cpp
idx = (idx + 1) & (capacity - 1);
```
Bitwise `AND` executes in a **single clock cycle (0.3 nanoseconds)** and can be executed concurrently by the CPU's ALU pipelines.

---

## 5. Formal SPSC Ring Buffer State Machine

### 5.1 Invariants
- `capacity_` is a power of 2 ($2^N$).
- `mask_ = capacity_ - 1`.
- `buffer_` is pre-allocated with `capacity_` contiguous elements (zero dynamic allocation after construction).
- Only the **Producer thread** modifies `write_idx_`.
- Only the **Consumer thread** modifies `read_idx_`.

### 5.2 Emptiness & Fullness Proofs
Let $W = \text{write\_idx\_}$ and $R = \text{read\_idx\_}$ (monotonically increasing 64-bit counters).

- **Empty Condition:**
  $$\text{empty} \iff W == R$$
- **Full Condition:**
  $$\text{full} \iff (W - R) \ge \text{capacity\_}$$
- **Current Size:**
  $$\text{size} = W - R$$

By allowing 64-bit integer counters to increment monotonically without wrapping at `capacity_`, we can utilize the full capacity of the buffer (no "wasted slot" needed). The physical buffer slot is mapped purely via `index & mask_`.

---

## 6. Summary Checklist for Implementation
- [x] Pre-allocate contiguous memory buffer at startup.
- [x] Enforce power-of-two capacity via `roundUpToPowerOfTwo`.
- [x] Isolate atomic indices with `alignas(64)`.
- [x] Apply `memory_order_release` when publishing updated indices.
- [x] Apply `memory_order_acquire` when inspecting the counter of the opposite core.
- [x] Zero heap allocation during `enqueue()` and `dequeue()`.
