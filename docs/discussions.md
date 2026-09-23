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
