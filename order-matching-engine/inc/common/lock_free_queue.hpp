#pragma once

#include <atomic>
#include <cstddef>
#include <stdexcept>
#include <utility>
#include <vector>

namespace common {

/**
 * @brief Lock-Free Single-Producer Single-Consumer (SPSC) Ring Buffer.
 *
 * Designed for deterministic, ultra-low latency inter-thread communication.
 * Key properties:
 *  - Power-of-2 capacity for single-cycle bitwise masking (& mask_).
 *  - Cache-line padding (alignas(64)) to eliminate false sharing.
 *  - Monotonically increasing 64-bit indices with acquire/release memory semantics.
 */
template <typename T>
class LFQueue final {
public:
    explicit LFQueue(size_t capacity)
        : capacity_(capacity == 0 ? throw std::invalid_argument("Capacity must be greater than zero")
                                  : nextPowerOfTwo(capacity)),
          mask_(capacity_ - 1),
          buffer_(capacity_) {}

    ~LFQueue() = default;

    LFQueue(const LFQueue&) = delete;
    LFQueue& operator=(const LFQueue&) = delete;
    LFQueue(LFQueue&&) = delete;
    LFQueue& operator=(LFQueue&&) = delete;

    /**
     * @brief Enqueue an element by copy (Producer thread only).
     * @param element Item to enqueue.
     * @return true if successfully pushed; false if ring buffer is saturated.
     */
    [[nodiscard("Ignoring enqueue status causes silent order drops under saturation")]]
    bool enqueue(const T& element) {
        const size_t currentWrite = writeIndex_.load(std::memory_order_relaxed);
        const size_t currentRead = readIndex_.load(std::memory_order_acquire);

        if (currentWrite - currentRead >= capacity_) {
            return false;
        }

        buffer_[currentWrite & mask_] = element;
        writeIndex_.store(currentWrite + 1, std::memory_order_release);
        return true;
    }

    /**
     * @brief Enqueue an element by move (Producer thread only).
     * @param element Item to move into the queue.
     * @return true if successfully pushed; false if ring buffer is saturated.
     */
    [[nodiscard("Ignoring enqueue status causes silent order drops under saturation")]]
    bool enqueue(T&& element) {
        const size_t currentWrite = writeIndex_.load(std::memory_order_relaxed);
        const size_t currentRead = readIndex_.load(std::memory_order_acquire);

        if (currentWrite - currentRead >= capacity_) {
            return false;
        }

        buffer_[currentWrite & mask_] = std::move(element);
        writeIndex_.store(currentWrite + 1, std::memory_order_release);
        return true;
    }

    /**
     * @brief Dequeue an element (Consumer thread only).
     * @param element Output reference receiving the moved element.
     * @return true if successfully popped; false if queue is empty.
     */
    [[nodiscard("Ignoring dequeue status can result in processing stale or uninitialized data if the queue is empty")]]
    bool dequeue(T& element) {
        const size_t currentRead = readIndex_.load(std::memory_order_relaxed);
        const size_t currentWrite = writeIndex_.load(std::memory_order_acquire);

        if (currentWrite == currentRead) {
            return false;
        }

        element = std::move(buffer_[currentRead & mask_]);
        readIndex_.store(currentRead + 1, std::memory_order_release);
        return true;
    }

    [[nodiscard]] size_t size() const noexcept {
        const size_t w = writeIndex_.load(std::memory_order_relaxed);
        const size_t r = readIndex_.load(std::memory_order_relaxed);
        return w - r;
    }

    [[nodiscard]] bool empty() const noexcept {
        return writeIndex_.load(std::memory_order_relaxed) == readIndex_.load(std::memory_order_relaxed);
    }

    [[nodiscard]] bool full() const noexcept {
        return size() >= capacity_;
    }

    [[nodiscard]] size_t capacity() const noexcept {
        return capacity_;
    }

private:
    static size_t nextPowerOfTwo(size_t val) {
        if (val <= 1) {
            return 1;
        }
        size_t power = 1;
        while (power < val) {
            power <<= 1;
        }
        return power;
    }

    const size_t capacity_;
    const size_t mask_;
    std::vector<T> buffer_;

    alignas(64) std::atomic<size_t> writeIndex_{0};
    alignas(64) std::atomic<size_t> readIndex_{0};
};

} // namespace common
