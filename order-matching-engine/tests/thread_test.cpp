#include "common/thread.h"
#include <atomic>
#include <cstdlib>
#include <iostream>
#include <thread>

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

void testSetCurrentThreadAffinity() {
    const unsigned int hardwareCores = std::thread::hardware_concurrency();
    ASSERT_TRUE(hardwareCores > 0, "Hardware cores must be > 0");

    // Pinning to invalid negative core must fail
    ASSERT_TRUE(!setCurrentThreadAffinity(-1), "Negative core must fail");

    // Pinning to core 0 should succeed
    const bool pinned = setCurrentThreadAffinity(0);
    ASSERT_TRUE(pinned, "Pinning to core 0 should succeed");

    const int currentCore = getCurrentThreadCore();
    ASSERT_TRUE(currentCore >= 0, "Current core must be non-negative");
    ASSERT_EQ(currentCore, 0, "Current core should be 0 after affinity pinning");

    std::cout << "[PASS] testSetCurrentThreadAffinity\n";
}

void testSetThreadAffinityOnWorker() {
    const unsigned int hardwareCores = std::thread::hardware_concurrency();
    if (hardwareCores < 2) {
        std::cout << "[SKIP] testSetThreadAffinityOnWorker (requires >= 2 cores)\n";
        return;
    }

    std::atomic<bool> threadStarted{false};
    std::atomic<bool> threadDone{false};
    std::atomic<int> workerCore{-1};

    std::thread worker([&]() {
        threadStarted.store(true);
        while (!threadDone.load()) {
            std::this_thread::yield();
        }
        workerCore.store(getCurrentThreadCore());
    });

    while (!threadStarted.load()) {
        std::this_thread::yield();
    }

    const bool pinned = setThreadAffinity(worker, 1);
    ASSERT_TRUE(pinned, "Pinning worker thread to core 1 must succeed");

    threadDone.store(true);
    worker.join();

    ASSERT_EQ(workerCore.load(), 1, "Worker thread should execute on core 1");

    std::cout << "[PASS] testSetThreadAffinityOnWorker\n";
}

void testSetThreadName() {
    ASSERT_TRUE(setThreadName("test_worker"), "Setting valid thread name must succeed");
    ASSERT_TRUE(!setThreadName(""), "Setting empty thread name must fail");
    std::cout << "[PASS] testSetThreadName\n";
}

int main() {
    std::cout << "Running Thread affinity test suite...\n";

    testSetCurrentThreadAffinity();
    testSetThreadAffinityOnWorker();
    testSetThreadName();

    std::cout << "All Thread tests passed successfully!\n";
    return 0;
}
