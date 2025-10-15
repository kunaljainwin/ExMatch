#pragma once
#include <iostream>
#include <queue>
#include <mutex>

template <typename T>
class LQueue final
{
public:
    // LQueue(size_t cap){}
    ~LQueue() {}
    LQueue() = default;
    // LQueue(const LQueue &) = delete;
    // LQueue(const LQueue &&) = delete;
    // LQueue &operator=(const LQueue &) = delete;
    // LQueue &operator=(const LQueue &&) = delete;
    // Copy constructor
    LQueue(const LQueue &other)
    {
        std::lock_guard<std::mutex> lock(other.mtx);
        que = other.que;
    }

    // Copy assignment operator
    LQueue &operator=(const LQueue &other)
    {
        if (this == &other)
            return *this;

        // Lock both mutexes without deadlock
        std::scoped_lock lock(mtx, other.mtx);
        que = other.que; // copy underlying queue
        return *this;
    }

    // Move constructor
    LQueue(LQueue &&other) noexcept
    {
        std::lock_guard<std::mutex> lock(other.mtx);
        que = std::move(other.que);
    }

    // Move assignment
    LQueue &operator=(LQueue &&other) noexcept
    {
        if (this == &other)
            return *this;

        std::scoped_lock lock(mtx, other.mtx);
        que = std::move(other.que);
        return *this;
    }

    // get capacity
    size_t capacity() const
    {
        return INT_MAX;
    }
    auto size()
    {
        std::lock_guard<std::mutex> lock(mtx);
        return que.size();
    }
    // Check if queue is empty
    bool empty() const
    {
        std::lock_guard<std::mutex> lock(mtx);
        return que.empty();
    }

    // Enqueue element, returns false if full
    bool enqueue(const T &element)
    {
        std::lock_guard<std::mutex> lock(mtx); // locks on creation, unlocks automatically when it goes out of scope
        que.push(element);
        return true;
    }

    // Dequeue element, returns false if empty
    bool dequeue(T &element)
    {
        std::lock_guard<std::mutex> lock(mtx); // locks on creation, unlocks automatically when it goes out of scope

        if (que.empty())
            return false;      // queue empty
        element = que.front(); // get front element
        que.pop();             // remove it
        return true;
    }

private:
    std::queue<T> que;
    mutable std::mutex mtx;
};
