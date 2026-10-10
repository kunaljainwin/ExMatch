#pragma once

#include <cstddef>
#include <new>
#include <utility>
#include <vector>

namespace common {

/**
 * @brief High-performance chunked Object Pool providing stable pointers with zero heap
 *        allocation on the critical path once warmed.
 */
template <typename T, size_t BlockSize = 4096>
class ObjectPool final {
public:
    explicit ObjectPool(size_t initialBlocks = 16) {
        reserveBlocks(initialBlocks == 0 ? 1 : initialBlocks);
    }

    ~ObjectPool() {
        for (auto* block : blocks_) {
            delete[] block;
        }
    }

    ObjectPool(const ObjectPool&) = delete;
    ObjectPool& operator=(const ObjectPool&) = delete;
    ObjectPool(ObjectPool&&) = delete;
    ObjectPool& operator=(ObjectPool&&) = delete;

    template <typename... Args>
    [[nodiscard]] T* acquire(Args&&... args) {
        if (freeList_.empty()) {
            allocateBlock();
        }

        Slot* slot = freeList_.back();
        freeList_.pop_back();

        T* obj = reinterpret_cast<T*>(&slot->storage);
        ::new (static_cast<void*>(obj)) T(std::forward<Args>(args)...);
        return obj;
    }

    void release(T* ptr) noexcept {
        if (!ptr) {
            return;
        }
        ptr->~T();
        Slot* slot = reinterpret_cast<Slot*>(ptr);
        freeList_.push_back(slot);
    }

    [[nodiscard]] size_t totalCapacity() const noexcept {
        return blocks_.size() * BlockSize;
    }

    [[nodiscard]] size_t available() const noexcept {
        return freeList_.size();
    }

private:
    union Slot {
        alignas(alignof(T)) std::byte storage[sizeof(T)];
    };

    void reserveBlocks(size_t count) {
        blocks_.reserve(count);
        freeList_.reserve(count * BlockSize);
        for (size_t i = 0; i < count; ++i) {
            allocateBlock();
        }
    }

    void allocateBlock() {
        Slot* block = new Slot[BlockSize];
        blocks_.push_back(block);
        for (size_t i = 0; i < BlockSize; ++i) {
            freeList_.push_back(&block[i]);
        }
    }

    std::vector<Slot*> blocks_;
    std::vector<Slot*> freeList_;
};

} // namespace common
