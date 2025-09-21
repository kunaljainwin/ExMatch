#pragma once
#include<iostream>
#include <vector>
#include <atomic>

template <typename T>
class LFQueue final 
{

    LFQueue(size_t cap) : vec(cap , T()) {}
    ~LFQueue() {}
    LFQueue() = delete;
    LFQueue(const LFQueue &) = delete;
    LFQueue(const LFQueue &&) = delete;
    LFQueue &operator=(const LFQueue &) = delete;
    LFQueue &operator=(const LFQueue &&) = delete;
    //get capacity
    bool capacity() const {
        return vec.size();
    }
    auto nextReadIndex()
    {
        return (size() ? (&vec[read]) : nullptr);
    }
    auto updateReadIndex()
    {
        read = (read + 1) % capacity();
        num_elements--;
    }
    auto nextWriteIndex()
    {
        return &vec[write];
    }
    auto updateWriteIndex()
    {
        write = (write + 1) % capacity();
        num_elements++;
    }

    auto size()
    {
        auto w = write.load(std::memory_order_acquire);
        auto r = read.load(std::memory_order_acquire);

        return (w - r + capacity()) % capacity();
    }
    //check full
    bool full() const {
        auto next = (write.load() + 1) % capacity();
        return next == read.load();
    }
    void enqueue(T element)
    {
        
    }
    void deueue(T element)
    {
        
    }
private:
    std::vector<T> vec;
    std::atomic<size_t> read(0);
    std::atomic<size_t> write(0);
};
