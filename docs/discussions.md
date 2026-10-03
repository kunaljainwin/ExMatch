# Technical Discussions & Q&A Log

A quick-reference journal recording all architectural, language, and systems design doubts raised during development, along with their concise answers.

---

| # | Question / Doubt | One-Line Architectural / Systems Answer |
| :---: | :--- | :--- |
| **1** | Why use fixed-point `int64_t Price` instead of `double` or `float`? | IEEE-754 binary floats introduce rounding errors ($0.1 + 0.2 \ne 0.3$); integer ticks guarantee exact sub-penny mathematical precision without balance discrepancies. |
| **2** | Why define enums as `enum class Name : uint8_t`? | `enum class` prevents accidental implicit conversion to `int`, and `: uint8_t` reduces size from 4 bytes to 1 byte, packing more orders per 64-byte CPU cache line. |
| **3** | Why pass `Side side` by value instead of `const Side&`? | `Side` is 1 byte and loads directly into a CPU register (0 cycles); passing by reference passes an 8-byte memory pointer and incurs an extra memory dereference. |
| **4** | Why are namespace contents not indented 4 spaces? | Zero-indenting namespaces avoids horizontal "indentation creep" across nested scopes, preserving code readability per Google/LLVM C++ standards. |
| **5** | Why remove `std_libs.h` and `common.h`? | Monolithic include headers balloon compilation times and mask missing header dependencies; each file must explicitly declare only what it needs. |
| **6** | Why remove `utils.h` (`trim`, `fileExists`)? | It declared functions with no `.cpp` implementation file in the repository, which causes linker errors (`undefined reference`); dead code is eliminated. |
| **7** | Is `ExMatch` connecting to an external exchange simulator? | No; `ExMatch` is the standalone Trading Suite platform where we build all core exchange engines (`order-matching-engine`, `trading-gateway`, `market-data-engine`, `risk-management`) in-house. |
| **8** | Why use SPSC lock-free queues instead of `std::mutex` in matching? | Contested mutexes cause OS kernel context switches ($1\text{--}5\,\mu\text{s}$ delay) and latency jitter; SPSC ring buffers execute wait-free in $< 10\text{ ns}$ using atomic memory fences. |
| **9** | Why pad atomic indices with `alignas(64)`? | It forces read and write indices onto separate 64-byte CPU cache lines, eliminating False Sharing and cache-line invalidation ping-pong between cores. |
| **10** | Why enforce power-of-two capacities ($C = 2^N$) in ring buffers? | It replaces hardware integer division modulo `%` ($15\text{--}25$ CPU cycles) with single-cycle bitwise AND `& (capacity - 1)` ($1$ clock cycle / 0.3 ns). |
| **11** | Why different casing for files in `docs/` (`discussions.md` vs `sprint_backlog.md`)? | Root files use uppercase (`README.md`, `LICENSE`) for entry visibility, but internal docs follow strict lowercase-with-underscores (`docs/discussions.md`) for consistency. |
| **12** | Why trailing underscore in private members (`orderId_`)? | Prevents parameter shadowing (`this->`), avoids getter name collisions, and avoids compiler-reserved leading underscores (`_name`) per Google/LLVM C++ standards. |
| **13** | How does `acquire`/`release` memory ordering prevent data corruption in lock-free queues without locks? | The producer's `release` store commits all payload buffer writes before publishing `writeIndex_`, while the consumer's `acquire` load synchronizes with it, preventing the CPU from speculatively reading buffer memory before verifying data availability. |
| **14** | What is False Sharing and how does `alignas(64)` eliminate it? | When independent variables share a 64-byte cache line, writes by one core invalidate the other core's L1 cache via MESI coherency; `alignas(64)` pads each atomic index onto its own dedicated cache line to eliminate ping-pong invalidations. |
| **15** | Why partition matching engines by symbol instead of threading within a single order book? | An order book requires a single deterministic total order for price-time priority; multithreading a single book causes lock contention, while symbol partitioning isolates independent state machines with zero cross-talk. |
| **16** | Why use monotonic sequence numbers instead of wall-clock timestamps for event ordering? | Wall-clock timestamps are vulnerable to NTP adjustments, clock drift, and identical timestamp collisions; monotonic sequence numbers guarantee an unambiguous, strictly contiguous total order for deterministic execution and replay. |
| **17** | Why is Redis prohibited in the hot matching path, and where does it belong? | Network/IPC hops and serialization introduce 50–500 µs latency spikes; matching must stay strictly in RAM, while Redis is suited only for non-hot-path metadata, user session auth, and gateway idempotency tokens. |
| **18** | What is sequence-gap detection during engine recovery, and why must the engine halt? | If an expected sequence jump occurs ($N \to N+2$), state machine transitions are missing; proceeding would corrupt order book depth and balances, so the engine halts until the missing event is retrieved. |
| **19** | How do periodic snapshots and the event log interact safely without data loss? | Snapshots serialize state at sequence $N$ with a checksum, and recovery streams the log starting at $N+1$; event log segments are never pruned until snapshot persistence and integrity are verified on disk. |
| **20** | What is the architectural trade-off between synchronous vs asynchronous event persistence? | Synchronous WAL guarantees zero data loss on power death but adds 10–100 µs disk latency; asynchronous/batched flushing delivers sub-microsecond matching latency with bounded recovery complexity. |
| **21** | How does an active-passive standby engine achieve near-instantaneous failover? | The standby shadow-replays the event log in RAM in real time; on primary failure, it takes ownership immediately at the latest sequence number without needing to rebuild state from cold disk snapshots. |

