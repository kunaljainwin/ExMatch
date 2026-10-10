#include "common/lock_free_queue.hpp"
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <thread>
#include <vector>

using namespace common;

#define ASSERT_TRUE(condition, message) \
    do { \
        if (!(condition)) { \
            std::cerr << "FAILED: " << (message) << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

#define ASSERT_EQ(actual, expected, message) \
    do { \
        if ((actual) != (expected)) { \
            std::cerr << "FAILED: " << (message) << " [Expected: " << (expected) \
                      << ", Actual: " << (actual) << "] (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

void testQueueBasicOperations() {
    LFQueue<int> queue(4); // Power of 2: 4
    ASSERT_EQ(queue.capacity(), 4, "Capacity should be 4");
    ASSERT_TRUE(queue.empty(), "New queue should be empty");
    ASSERT_EQ(queue.size(), 0, "Initial size should be 0");

    int poppedValue = -1;
    ASSERT_TRUE(!queue.dequeue(poppedValue), "Dequeue from empty queue should return false");

    ASSERT_TRUE(queue.enqueue(10), "Enqueue 10 should succeed");
    ASSERT_TRUE(queue.enqueue(20), "Enqueue 20 should succeed");
    ASSERT_TRUE(queue.enqueue(30), "Enqueue 30 should succeed");
    ASSERT_TRUE(queue.enqueue(40), "Enqueue 40 should succeed");

    ASSERT_TRUE(queue.full(), "Queue should be full after 4 items");
    ASSERT_EQ(queue.size(), 4, "Queue size should be 4");
    ASSERT_TRUE(!queue.enqueue(50), "Enqueue to full queue must fail");

    ASSERT_TRUE(queue.dequeue(poppedValue), "Dequeue 1st item should succeed");
    ASSERT_EQ(poppedValue, 10, "First dequeued item mismatch");

    ASSERT_TRUE(queue.dequeue(poppedValue), "Dequeue 2nd item should succeed");
    ASSERT_EQ(poppedValue, 20, "Second dequeued item mismatch");

    ASSERT_TRUE(queue.enqueue(50), "Enqueue after partial dequeue should succeed");
    ASSERT_TRUE(queue.enqueue(60), "Enqueue after partial dequeue should succeed");
    ASSERT_TRUE(queue.full(), "Queue should be full again");

    std::vector<int> expectedRemaining = {30, 40, 50, 60};
    for (int expected : expectedRemaining) {
        ASSERT_TRUE(queue.dequeue(poppedValue), "Dequeue expected remaining item");
        ASSERT_EQ(poppedValue, expected, "Mismatch in remaining items");
    }

    ASSERT_TRUE(queue.empty(), "Queue should be empty after reading all items");
}

void testQueueEmplace() {
    struct TestItem {
        int a;
        double b;
        TestItem() : a(0), b(0.0) {}
        TestItem(int x, double y) : a(x), b(y) {}
    };

    LFQueue<TestItem> queue(4);
    ASSERT_TRUE(queue.emplace(1, 2.5), "Emplace first item should succeed");
    ASSERT_TRUE(queue.emplace(2, 3.5), "Emplace second item should succeed");
    ASSERT_EQ(queue.size(), 2, "Size should be 2 after 2 emplaces");

    TestItem out;
    ASSERT_TRUE(queue.dequeue(out), "Dequeue first emplaced item");
    ASSERT_EQ(out.a, 1, "First emplaced item.a mismatch");
    ASSERT_TRUE(out.b == 2.5, "First emplaced item.b mismatch");

    ASSERT_TRUE(queue.dequeue(out), "Dequeue second emplaced item");
    ASSERT_EQ(out.a, 2, "Second emplaced item.a mismatch");
    ASSERT_TRUE(out.b == 3.5, "Second emplaced item.b mismatch");
    ASSERT_TRUE(queue.empty(), "Queue should be empty");
}

void testQueueZeroCapacityThrows() {
    bool caught = false;
    try {
        LFQueue<int> queue(0);
    } catch (const std::invalid_argument&) {
        caught = true;
    }
    ASSERT_TRUE(caught, "Capacity 0 must throw std::invalid_argument");
}

void testQueuePowerOfTwoRounding() {
    LFQueue<int> queue(5); // Non-power of 2: should round up to 8
    ASSERT_EQ(queue.capacity(), 8, "Capacity 5 should round up to 8");

    for (int i = 0; i < 8; ++i) {
        ASSERT_TRUE(queue.enqueue(i), "Enqueue up to rounded capacity");
    }
    ASSERT_TRUE(queue.full(), "Queue should be full at 8 items");
    ASSERT_TRUE(!queue.enqueue(999), "Enqueue beyond rounded capacity should fail");
}

void testConcurrentSPSCIntegrity() {
    constexpr size_t kTotalMessages = 500000;
    constexpr size_t kQueueCapacity = 1024;

    LFQueue<uint64_t> queue(kQueueCapacity);
    std::atomic<bool> producerDone{false};

    std::thread producer([&queue]() {
        for (uint64_t i = 1; i <= kTotalMessages; ++i) {
            while (!queue.enqueue(i)) {
                // SPSC backoff (busy-yield)
                std::this_thread::yield();
            }
        }
    });

    std::vector<uint64_t> received;
    received.reserve(kTotalMessages);

    std::thread consumer([&queue, &received]() {
        uint64_t val = 0;
        while (received.size() < kTotalMessages) {
            if (queue.dequeue(val)) {
                received.push_back(val);
            } else {
                std::this_thread::yield();
            }
        }
    });

    producer.join();
    consumer.join();

    ASSERT_EQ(received.size(), kTotalMessages, "Must receive exact number of messages");
    for (size_t i = 0; i < kTotalMessages; ++i) {
        ASSERT_EQ(received[i], static_cast<uint64_t>(i + 1), "Sequence ordering corrupted");
    }
}

int main() {
    std::cout << "Running LFQueue unit and concurrency tests...\n";

    testQueueBasicOperations();
    std::cout << "  [PASS] testQueueBasicOperations\n";

    testQueuePowerOfTwoRounding();
    std::cout << "  [PASS] testQueuePowerOfTwoRounding\n";

    testQueueZeroCapacityThrows();
    std::cout << "  [PASS] testQueueZeroCapacityThrows\n";

    testQueueEmplace();
    std::cout << "  [PASS] testQueueEmplace\n";

    testConcurrentSPSCIntegrity();
    std::cout << "  [PASS] testConcurrentSPSCIntegrity (500,000 messages across threads)\n";

    std::cout << "All LFQueue tests passed successfully!\n";
    return 0;
}
